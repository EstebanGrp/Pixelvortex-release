/**
 * AdvancedEMF Loader - v1.1
 * Soporte para modelos .jem (OptiFine/EMF) y texturas .properties (ETF).
 * Incluye inyección de UI en Settings y carga de Resource Packs locales.
 */

(function() {
    // CACHE BUSTER & DEBUG
    console.clear();
    console.log("%c [AdvancedEMF] CARGANDO VERSIÓN 1.3 (TITAN DETECTION) ", "background: #e76f51; color: white; font-size: 20px; padding: 10px;");
    
    // Alerta temporal para confirmar carga visualmente al usuario
    // setTimeout(() => alert("Advanced EMF v1.2: Mod Actualizado Correctamente.\nYa puedes usar el selector de carpetas."), 1000);

    console.log("[AdvancedEMF] Iniciando sistema de carga avanzado v1.2...");

    // 1. Detección de Entorno y Sistema de Archivos
    const isNode = typeof require !== 'undefined';
    let fs = null, path = null;
    if (isNode) {
        try {
            fs = require('fs');
            path = require('path');
        } catch (e) {
            console.warn("[AdvancedEMF] Entorno Node detectado pero no se pudo cargar fs/path:", e);
        }
    }

    // Estado Global
    const State = {
        enabled: true,
        loadedPacks: [], // { name, path, files: Map<relativePath, content> }
        models: new Map(), // entityType -> JEM Model Data
        textures: new Map(), // entityType -> ETF Properties
        
        // Estado Gráfico (Hookeado)
        gameScene: null,
        gameCamera: null,
        renderer: null,
        hookStatus: "Buscando..."
    };

    // 2. Parser y Gestores (JEM/ETF)
    let T = (typeof THREE !== 'undefined') ? THREE : null;

    // --- HOOK DE THREE.JS & DETECCIÓN DE ESCENA (Estilo TitanAndTiny) ---
    const findSceneAndPlayer = () => {
        // 1. Si ya tenemos la escena, solo actualizamos referencia si es necesario
        if (State.gameScene) return;

        // 2. Estrategia TitanAndTiny: Buscar al jugador en globales conocidas
        let player = null;
        let source = "";
        
        try {
            if (window.Game && window.Game.player) { player = window.Game.player; source = "Game.player"; }
            else if (window.game && window.game.player) { player = window.game.player; source = "game.player"; }
            else if (window.gameInstance && window.gameInstance.player) { player = window.gameInstance.player; source = "gameInst.player"; }
            else if (window.player) { player = window.player; source = "window.player"; }
            
            // Si encontramos al jugador, intentamos obtener su malla para subir a la escena
            if (player) {
                let mesh = null;
                if (typeof player.getClientModel === 'function') {
                    try { mesh = player.getClientModel(); } catch (e) {}
                }
                if (!mesh && player.mesh) mesh = player.mesh;
                
                // CRITICAL FIX: TitanAndTiny doesn't actually set State.gameScene from player.mesh.parent
                // It just modifies player.mesh directly.
                // However, for SceneInjector to work on OTHER entities, we NEED the scene.
                
                if (mesh && mesh.parent && mesh.parent.isScene) {
                    State.gameScene = mesh.parent;
                    State.hookStatus = `Conectado (Vía ${source})`;
                    console.log(`[AdvancedEMF] Escena encontrada a través del jugador (${source})`, State.gameScene);
                    return;
                } else if (mesh && mesh.parent && mesh.parent.parent && mesh.parent.parent.isScene) {
                     // Sometimes nested: Scene -> Group -> Player
                    State.gameScene = mesh.parent.parent;
                    State.hookStatus = `Conectado (Vía ${source} [Nested])`;
                    console.log(`[AdvancedEMF] Escena encontrada a través del jugador (Nested ${source})`, State.gameScene);
                    return;
                }
            }
        } catch (err) {
            console.warn("[AdvancedEMF] Error buscando jugador:", err);
        }

        // 3. Estrategia Fallback: Render Hook (Lo mantenemos por si acaso)
        if (!T && window.THREE) T = window.THREE;
        
        // Intentar buscar scene global directamente (como hace TitanAndTiny al asumir window.gameScene)
        if (window.gameScene && window.gameScene.isScene) {
             State.gameScene = window.gameScene;
             State.hookStatus = "Conectado (window.gameScene)";
             return;
        }

        // 4. Brute Force Search in Window (Last Resort)
        // A veces la escena está escondida en propiedades no obvias
        if (!State.gameScene) {
            const potentialScenes = [];
            Object.keys(window).forEach(key => {
                try {
                    if (window[key] && window[key].isScene) {
                        potentialScenes.push(window[key]);
                    } else if (window[key] && window[key].scene && window[key].scene.isScene) {
                        potentialScenes.push(window[key].scene);
                    }
                } catch(e) {}
            });
            
            if (potentialScenes.length > 0) {
                 State.gameScene = potentialScenes[0];
                 State.hookStatus = "Conectado (Brute Force)";
                 return;
            }
        }

        const possibleRoots = [window, window.app, window.game, window.pixelVortex];
        for (const root of possibleRoots) {
            if (root && root.scene && root.scene.isScene) {
                State.gameScene = root.scene;
                State.hookStatus = "Conectado (Raíz)";
                return;
            }
        }

        if (T && T.WebGLRenderer && !T.WebGLRenderer.prototype._hooked) {
            const oldRender = T.WebGLRenderer.prototype.render;
            T.WebGLRenderer.prototype.render = function(scene, camera) {
                if (!State.gameScene && scene && scene.isScene) {
                    State.gameScene = scene;
                    State.gameCamera = camera;
                    State.renderer = this;
                    State.hookStatus = "Conectado (Render Hook)";
                }
                return oldRender.apply(this, arguments);
            };
            T.WebGLRenderer.prototype._hooked = true;
        }
    };
    
    // Usamos un bucle de animación para intentar conectar constantemente hasta lograrlo
    // similar al gameLoop de TitanAndTiny
    const gameLoop = () => {
        requestAnimationFrame(gameLoop);
        findSceneAndPlayer();
        
        // Si tenemos escena y modelos cargados, intentamos aplicar periódicamente
        // (Pero con control para no saturar)
        if (State.gameScene && State.enabled && State.models.size > 0) {
             // Solo aplicar cada 60 frames o si hay cambios podría ser mejor, 
             // pero por ahora dejamos que SceneInjector decida (tiene chequeo de emfApplied)
             SceneInjector.apply();
        }
    };
    requestAnimationFrame(gameLoop);

    class JEMParser {
        parse(jsonString) {
            try {
                // Limpieza básica de comentarios tipo C //
                const clean = jsonString.replace(/\/\/.*$/gm, '');
                return JSON.parse(clean);
            } catch (e) {
                console.error("[AdvancedEMF] Error parseando JEM:", e);
                return null;
            }
        }
    }

    // Constructor de Geometría (JEM -> Three.js)
    class GeometryBuilder {
        constructor() {
            this.materialCache = new Map();
        }

        // Crea una malla Three.js a partir de la definición JEM
        build(modelData, texturePath = null) {
            if (!T) {
                // Si no hemos encontrado THREE aún, no podemos construir nada
                console.warn("[AdvancedEMF] THREE.js no encontrado, imposible construir geometría.");
                return null;
            }

            if (!modelData || !modelData.models) return null;

            const rootGroup = new T.Group();
            rootGroup.name = "JEM_Root";

            // Material base (blanco por defecto o textura si se provee)
            let material = new T.MeshBasicMaterial({ color: 0xffffff });
            
            // TODO: Cargar textura real si texturePath existe
            
            modelData.models.forEach(part => {
                const partGroup = new T.Group();
                partGroup.name = part.part; // Nombre del hueso (ej: "head", "body")
                
                // Aplicar transformaciones base del "part"
                if (part.translate) {
                    partGroup.position.set(part.translate[0], part.translate[1], part.translate[2]);
                }
                if (part.rotate) {
                    // JEM usa grados, Three.js usa radianes
                    partGroup.rotation.set(
                        part.rotate[0] * (Math.PI / 180),
                        part.rotate[1] * (Math.PI / 180),
                        part.rotate[2] * (Math.PI / 180)
                    );
                }

                // Construir las cajas (submodelos)
                if (part.boxes) {
                    part.boxes.forEach(box => {
                        const coords = box.coordinates; // [x, y, z, w, h, d]
                        if (!coords || coords.length < 6) return;

                        const geometry = new T.BoxGeometry(coords[3], coords[4], coords[5]);
                        const mesh = new T.Mesh(geometry, material);

                        // Ajuste de posición: JEM define la esquina, Three.js el centro
                        // Además, el sistema de coordenadas de Minecraft es distinto al de Three.js estándar
                        // Minecraft: +Y up, +Z south, +X east
                        // Three.js: +Y up, +Z front, +X right
                        // Es posible que requiera inversión de ejes según la cámara del juego.
                        
                        mesh.position.set(
                            coords[0] + coords[3] / 2,
                            coords[1] + coords[4] / 2,
                            coords[2] + coords[5] / 2
                        );

                        // Soporte para UVs personalizadas del JEM (textureOffset)
                        if (box.textureOffset) {
                            // Aquí iría la lógica compleja de mapeo UV
                        }

                        partGroup.add(mesh);
                    });
                }
                
                // Soporte para submodelos anidados (submodels)
                if (part.submodels) {
                    // Recursividad para submodelos
                    // (Implementación simplificada)
                }

                rootGroup.add(partGroup);
            });

            return rootGroup;
        }
    }

    class ResourcePackLoader {
        constructor() {
            this.defaultPath = "c:\\Users\\etc}\\Desktop\\github\\Pixelvortex-releases\\pixelvortex 3.2.41\\pixelvortex 3.2.41\\resource_packs\\DetailedAnimationsReworked - V1.15 PATCH";
        }

        async loadPack(packPath) {
            console.log(`[AdvancedEMF] Intentando cargar pack desde: ${packPath}`);
            
            if (!fs || !path) {
                console.error("[AdvancedEMF] Sistema de archivos no disponible. No se pueden cargar packs locales.");
                alert("Error: File System access denied or not available (Not running in Electron/Node?).");
                return false;
            }

            if (!fs.existsSync(packPath)) {
                console.error(`[AdvancedEMF] La ruta no existe: ${packPath}`);
                return false;
            }

            const packData = {
                name: path.basename(packPath),
                path: packPath,
                files: new Map()
            };

            // Escaneo recursivo buscando .jem y .properties
            const scanDir = (dir, relativeRoot = "") => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    const relPath = path.join(relativeRoot, file).replace(/\\/g, '/'); // Normalizar a forward slashes

                    if (stat.isDirectory()) {
                        scanDir(fullPath, relPath);
                    } else {
                        if (file.endsWith('.jem') || file.endsWith('.properties') || file.endsWith('.png')) {
                            // Leemos el contenido (texto para jem/prop, base64/buffer para png si fuera necesario)
                            // Por ahora solo texto para config
                            if (!file.endsWith('.png')) {
                                const content = fs.readFileSync(fullPath, 'utf-8');
                                packData.files.set(relPath, content);
                                
                                // Auto-registro de modelos JEM
                                if (file.endsWith('.jem')) {
                                    const entityName = path.basename(file, '.jem');
                                    console.log(`[AdvancedEMF] Encontrado modelo JEM: ${entityName} en ${relPath}`);
                                    const modelData = new JEMParser().parse(content);
                                    if (modelData) {
                                        State.models.set(entityName, modelData);
                                    }
                                }
                            }
                        }
                    }
                }
            };

            // Empezamos escaneo en assets/minecraft/optifine/cem o similar
            // Pero escaneamos todo para ser flexibles
            try {
                scanDir(packPath);
                State.loadedPacks.push(packData);
                console.log(`[AdvancedEMF] Pack cargado exitosamente: ${packData.name} (${packData.files.size} archivos relevantes)`);
                return true;
            } catch (e) {
                console.error("[AdvancedEMF] Error escaneando pack:", e);
                return false;
            }
        }
    }

    // 3. Inyector de Escena (Experimental)
    const SceneInjector = {
        apply: function() {
            // ... (código existente)
            console.log("[AdvancedEMF] Intentando aplicar modelos a la escena...");
            const scene = window.scene || (window.app && window.app.scene) || (window.game && window.game.scene);
            
            if (!scene) {
                console.warn("[AdvancedEMF] No se encontró la escena global (window.scene). Buscando en el DOM...");
                return false;
            }
            // ...
            return 0; // Placeholder return
        }
    };
    
    // Sobreescribimos el método apply real usando la escena capturada
    SceneInjector.apply = function() {
             console.log("[AdvancedEMF] Intentando aplicar modelos a la escena...");
             
             // USAMOS LA ESCENA CAPTURADA
             const scene = State.gameScene;
             
             if (!scene) {
                console.warn("[AdvancedEMF] No se encontró la escena global (window.scene) ni se capturó via hook.");
                // Intentar re-capturar
                findSceneAndPlayer();
                return false;
            }
 
             if (!scene.children) return false;
 
             let appliedCount = 0;
             const builder = new GeometryBuilder();
 
             // Recorremos la escena buscando entidades que coincidan con nuestros modelos cargados
            // Usamos traverse para búsqueda profunda (como TitanAndTiny)
            scene.traverse((obj) => {
                if (!obj.name) return;
                
                for (const [entityName, modelData] of State.models) {
                    if (obj.name.toLowerCase().includes(entityName)) {
                        if (obj.userData.emfApplied) return;
                        
                        console.log(`[AdvancedEMF] Aplicando modelo ${entityName} a objeto ${obj.name}`);
                        const customMesh = builder.build(modelData);
                        if (customMesh) {
                            obj.add(customMesh);
                            obj.userData.emfApplied = true;
                            appliedCount++;
                        }
                    }
                }
            });
            return appliedCount;
    };

    // 4. UI Injection (Inspirado en Titan & Tiny)
    const UI = {
        visible: false,
        
        injectButton: function() {
            // ... (código existente)
            const keywords = ["Video Settings", "Graphics", "Configuración de Video", "Gráficos", "Options", "Opciones"];
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"], .button'));
            let targetContainer = null;
            let referenceBtn = null;

            for (const btn of buttons) {
                if (btn.innerText && keywords.some(k => btn.innerText.includes(k))) {
                    referenceBtn = btn;
                    targetContainer = btn.parentElement;
                    break;
                }
            }

            if (!targetContainer) {
                const mainMenus = document.querySelectorAll('#main-menu, .menu-container');
                if (mainMenus.length > 0) targetContainer = mainMenus[0];
            }

            if (targetContainer && !document.getElementById('advanced-emf-btn')) {
                const btn = document.createElement('button');
                btn.id = 'advanced-emf-btn';
                btn.innerText = 'Advanced EMF';
                if (referenceBtn) {
                    btn.className = referenceBtn.className;
                    btn.style.cssText = referenceBtn.style.cssText;
                } else {
                    btn.style.padding = "10px"; btn.style.margin = "5px"; btn.style.backgroundColor = "#444"; btn.style.color = "white"; btn.style.border = "1px solid #666";
                }
                btn.style.marginTop = '5px';
                btn.style.width = '100%';
                btn.style.backgroundColor = '#2a9d8f';
                btn.onclick = () => this.togglePanel();
                targetContainer.appendChild(btn);
                console.log("[AdvancedEMF] Botón de configuración inyectado.");
            }
        },

        createPanel: function() {
            // Eliminar panel viejo si existe para forzar actualización UI
            const oldPanel = document.getElementById('emf-config-panel');
            if (oldPanel) oldPanel.remove();

            const panel = document.createElement('div');
            panel.id = 'emf-config-panel';
            panel.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.9); 
                display: none; z-index: 99999; 
                flex-direction: column; align-items: center; justify-content: center;
                font-family: sans-serif; color: white;
            `;

            const fsAvailable = (fs && path);
            const fsDisplay = fsAvailable ? 'block' : 'none';
            const fsWarning = fsAvailable ? '' : '<p style="color: #e76f51; font-size: 12px; margin-top:5px;">⚠️ Modo Sandbox: Acceso directo a disco no disponible. Usa la opción de arriba.</p>';

            panel.innerHTML = `
                <div style="background: #222; padding: 30px; border-radius: 10px; width: 600px; max-width: 90%;">
                    <h2 style="color: #2a9d8f; margin-top: 0;">Advanced EMF & ETF Loader v1.2</h2>
                    <p style="color: #aaa; font-size: 14px;">Gestiona modelos personalizados y texturas dinámicas.</p>
                    
                    <div style="margin: 20px 0; border-bottom: 1px solid #444; padding-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="emf-enable-toggle" ${State.enabled ? 'checked' : ''}>
                            <span style="font-weight: bold;">Habilitar Mod</span>
                        </label>
                        <div style="margin-top: 10px; font-size: 12px; color: ${State.gameScene ? '#2a9d8f' : '#e76f51'};">
                            🔌 Estado del Motor Gráfico: <b>${State.hookStatus}</b>
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <h3 style="font-size: 16px;">Cargar Resource Pack</h3>
                        
                        <!-- File Input para selección manual (Bypass de seguridad) -->
                        <div style="margin-bottom: 15px; border: 1px solid #2a9d8f; padding: 15px; background: #2a2a2a; border-radius: 5px;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #fff; font-weight: bold;">📂 Método Recomendado</p>
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #ccc;">Selecciona la carpeta raíz de tu resource pack (donde está 'assets' o 'pack.mcmeta').</p>
                            <input type="file" id="emf-dir-input" webkitdirectory directory multiple style="display: none;">
                            <button id="emf-select-dir-btn" style="width: 100%; padding: 12px; background: #2a9d8f; color: white; border: none; cursor: pointer; font-weight: bold; border-radius: 3px;">
                                Seleccionar Carpeta del Pack
                            </button>
                        </div>

                        <!-- Fallback FS (Solo Electron/Node) -->
                        <div style="opacity: ${fsAvailable ? '1' : '0.5'}; display: ${fsAvailable ? 'block' : 'block'};">
                            <p style="margin: 0 0 5px 0; font-size: 13px; color: #ccc;">Método Avanzado (Ruta Absoluta)</p>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="emf-pack-path" 
                                    value="${new ResourcePackLoader().defaultPath}" 
                                    placeholder="Ruta absoluta al resource pack..."
                                    ${fsAvailable ? '' : 'disabled'}
                                    style="flex: 1; padding: 8px; background: #333; border: 1px solid #555; color: white;">
                                <button id="emf-load-btn" ${fsAvailable ? '' : 'disabled'} style="padding: 8px 15px; background: #444; border: none; color: white; cursor: pointer;">
                                    Cargar desde Disco
                                </button>
                            </div>
                            ${fsWarning}
                        </div>
                    </div>

                    
                    <div style="margin-bottom: 15px; border-top: 1px solid #444; padding-top: 10px;">
                        <h3 style="font-size: 16px;">Herramientas de Debug</h3>
                        <button id="emf-apply-btn" style="width: 100%; padding: 10px; background: #e76f51; color: white; border: none; cursor: pointer;">
                            ⚠️ Aplicar Modelos a Escena (Experimental)
                        </button>
                        <p style="font-size: 11px; color: #888; margin-top: 5px;">Intenta inyectar los modelos cargados en la escena actual de Three.js.</p>
                    </div>

                    <div style="background: #111; padding: 10px; height: 150px; overflow-y: auto; border: 1px solid #333; margin-bottom: 20px;">
                        <div id="emf-pack-list" style="font-family: monospace; font-size: 12px; color: #ccc;">
                            <!-- Lista de packs cargados -->
                            <div style="color: #666; font-style: italic;">Ningún pack cargado.</div>
                        </div>
                    </div>

                    <div style="text-align: right;">
                        <button id="emf-close-btn" style="padding: 10px 20px; background: #555; border: none; color: white; cursor: pointer;">
                            Cerrar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(panel);

            // Event Listeners
            document.getElementById('emf-close-btn').onclick = () => this.togglePanel();
            
            document.getElementById('emf-enable-toggle').onchange = (e) => {
                State.enabled = e.target.checked;
                console.log("[AdvancedEMF] Habilitado:", State.enabled);
            };

            // Input de Archivos (FileReader)
            const fileInput = document.getElementById('emf-dir-input');
            const selectBtn = document.getElementById('emf-select-dir-btn');

            selectBtn.onclick = () => fileInput.click();

            fileInput.onchange = async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                selectBtn.innerText = "Procesando...";
                selectBtn.disabled = true;

                const packData = {
                    name: "Manual Pack (" + files[0].webkitRelativePath.split('/')[0] + ")",
                    path: "Manual Selection",
                    files: new Map()
                };

                let jemCount = 0;
                
                // Procesar archivos
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const relPath = file.webkitRelativePath; // ej: Pack/assets/minecraft/...
                    
                    if (file.name.endsWith('.jem') || file.name.endsWith('.properties')) {
                        try {
                            const text = await file.text();
                            packData.files.set(relPath, text);
                            
                            if (file.name.endsWith('.jem')) {
                                const entityName = file.name.replace('.jem', ''); // simple basename
                                const modelData = new JEMParser().parse(text);
                                if (modelData) {
                                    State.models.set(entityName, modelData);
                                    jemCount++;
                                }
                            }
                        } catch (err) {
                            console.warn("Error leyendo archivo:", file.name);
                        }
                    }
                }

                State.loadedPacks.push(packData);
                this.refreshPackList();
                
                selectBtn.innerText = "📂 Seleccionar carpeta 'resource_packs'";
                selectBtn.disabled = false;
                alert(`Carga manual completada.\nModelos JEM encontrados: ${jemCount}`);
            };

            // Carga FS (Original)
            document.getElementById('emf-load-btn').onclick = async () => {
                const pathVal = document.getElementById('emf-pack-path').value;
                const btn = document.getElementById('emf-load-btn');
                
                btn.disabled = true;
                btn.innerText = "Cargando...";
                
                const loader = new ResourcePackLoader();
                const success = await loader.loadPack(pathVal);
                
                btn.disabled = false;
                btn.innerText = "Cargar";

                if (success) {
                    this.refreshPackList();
                    alert(`Pack cargado correctamente!\nModelos encontrados: ${State.models.size}`);
                } else {
                    alert("Error cargando pack via FS. Intenta usar el botón 'Seleccionar Carpeta'.");
                }
            };

            // Aplicar cambios a escena
            document.getElementById('emf-apply-btn').onclick = () => {
                const btn = document.getElementById('emf-apply-apply-btn');
                const count = SceneInjector.apply();
                if (count !== false) {
                    alert(`Se aplicaron modelos a ${count} entidades en la escena.`);
                } else {
                    alert("No se pudo acceder a la escena (window.scene no definido) o no se encontraron entidades coincidentes.");
                }
            };
        },

        togglePanel: function() {
            if (!document.getElementById('emf-config-panel')) this.createPanel();
            
            const panel = document.getElementById('emf-config-panel');
            this.visible = !this.visible;
            panel.style.display = this.visible ? 'flex' : 'none';
            
            if (this.visible) this.refreshPackList();
        },

        refreshPackList: function() {
            const list = document.getElementById('emf-pack-list');
            if (!list) return;
            
            if (State.loadedPacks.length === 0) {
                list.innerHTML = '<div style="color: #666; font-style: italic;">Ningún pack cargado.</div>';
                return;
            }

            list.innerHTML = '';
            State.loadedPacks.forEach((pack, idx) => {
                const item = document.createElement('div');
                item.style.marginBottom = "5px";
                item.style.paddingBottom = "5px";
                item.style.borderBottom = "1px solid #222";
                item.innerHTML = `
                    <div style="color: #fff; font-weight: bold;">${pack.name}</div>
                    <div style="color: #888;">${pack.path}</div>
                    <div style="color: #2a9d8f;">Archivos: ${pack.files.size} | Modelos JEM detectados: ${Array.from(State.models.keys()).length}</div>
                `;
                list.appendChild(item);
            });
        }
    };

    // 4. API Pública
    window.AdvancedEMF = {
        injectSettings: () => UI.injectButton(),
        toggleMenu: () => UI.togglePanel(),
        loadPack: (path) => new ResourcePackLoader().loadPack(path),
        getState: () => State
    };

    // 5. Auto-arranque
    // Intentamos inyectar el botón periódicamente hasta que la UI del juego cargue
    const interval = setInterval(() => {
        if (document.body) { // Esperar a que el body exista
            UI.injectButton();
            // Si ya se inyectó, podríamos parar el intervalo, pero a veces el menú se redibuja
            // así que lo dejamos correr con check interno o lo paramos si encontramos el botón
            if (document.getElementById('advanced-emf-btn')) {
                clearInterval(interval);
                console.log("[AdvancedEMF] Inyección completada. Intervalo detenido.");
            }
        }
    }, 2000);

    // Carga inicial automática del pack por defecto si existe fs
    if (isNode) {
        setTimeout(() => {
            console.log("[AdvancedEMF] Intentando carga automática de pack por defecto...");
            new ResourcePackLoader().loadPack(new ResourcePackLoader().defaultPath);
        }, 3000);
    }

})();
