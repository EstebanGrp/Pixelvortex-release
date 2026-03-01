(function() {
    // Configuración por defecto (Fallback)
    const DEFAULT_CONFIG = { 
        "meta": { 
          "project": "Pixel Vortex", 
          "version": "1.0.0", 
          "last_update": "2026-01-04", 
          "source": "github" 
        }, 
        "global": { 
          "maintenance": false, 
          "maintenance_message": "Servidor en mantenimiento. Inténtalo más tarde.", 
          "force_update": false, 
          "min_launcher_version": "0.6.0", 
          "active_event": "none", 
          "motd": "" 
        }, 
        "ranks": { 
          "admin": { 
            "id": "admin", 
            "name": "Administrador", 
            "description": "Control total del launcher y del cliente", 
            "prefix": "[ADMIN]", 
            "style": { "color": "#ff3b3b", "bold": true, "glow": true }, 
            "priority": 100, 
            "permissions": ["all"] 
          }, 
          "dev": { 
            "id": "dev", 
            "name": "Developer", 
            "description": "Desarrollador del proyecto Pixel Vortex", 
            "prefix": "[DEV]", 
            "style": { "color": "#9b59ff", "bold": true, "glow": false }, 
            "priority": 80, 
            "permissions": ["dev_console"] 
          }, 
          "tester": { 
            "id": "tester", 
            "name": "Pv Tester", 
            "description": "Usuario encargado de probar versiones antes del lanzamiento público", 
            "prefix": "[Pv TESTER]", 
            "style": { "color": "#35cc95", "bold": true, "glow": true }, 
            "priority": 40, 
            "permissions": ["beta_access", "report_bugs"], 
            "default_skin": "textures/entity/skins/gladiador.png" 
          }, 
          "vip": { 
            "id": "vip", 
            "name": "VIP", 
            "description": "Usuario con beneficios cosméticos y prioridad", 
            "prefix": "[VIP]", 
            "style": { "color": "#ffd700", "bold": true, "glow": false }, 
            "priority": 50, 
            "permissions": ["cosmetics", "priority_queue"] 
          }, 
          "Pixelvortex": { 
            "id": "pixelvortex", 
            "name": "PixelVortex", 
            "description": "EL creador de pixelvortex :V", 
            "prefix": "[PixelVortex]", 
            "style": { "color": "#2227bd", "bold": true, "glow": true }, 
            "priority": 101, 
            "permissions": ["all"] 
          }, 
          "user": { 
            "id": "user", 
            "name": "Usuario", 
            "description": "Usuario estándar", 
            "prefix": "", 
            "icon": "textures/rank icon.png",
            "style": { "color": "#ffffff", "bold": false, "glow": false, "grayscale_icon": true }, 
            "priority": 0, 
            "permissions": [] 
          } 
        }, 
        "users": [ 
          { 
            "username": "EstebanGrp", 
            "uuid": "Esteban", 
            "rank": "user", 
            "status": { "banned": false, "ban_reason": null }, 
            "skin": { "active": "default", "variants": { "default": "textures/entity/skins/pvtester.png" } }, 
            "cosmetics": { "cape": "textures/entity/capes/pixelvortex.png", "hat": "" } 
          }, 
          { 
            "username": "PixelVortex_tester", 
            "uuid": "0003-TESTER", 
            "rank": "tester" 
          }, 
          { 
            "username": "Wolf_Shadow_Wolf", 
            "uuid": "Wolf_Shadow_Wolf", 
            "rank": "tester", 
            "status": { "banned": false, "ban_reason": null }, 
            "skin": { "active": "default", "variants": { "default": "textures/entity/skins/esteban.png" } }, 
            "cosmetics": { "cape": "textures/entity/capes/pixelvortex.png", "hat": "" } 
          } 
        ], 
        "bans": [ 
          { "username": "CheaterXD", "uuid": "BANNED-0003", "reason": "Uso de exploits", "date": "2026-01-01", "permanent": true }, 
          { "username": "TrollPlayer", "uuid": "BANNED-0004", "reason": "Abuso de bugs", "date": "2026-01-03", "permanent": false, "until": "2026-02-03" } 
        ], 
        "messages": { 
          "on_join": "", 
          "on_ban": "You have been banned: {reason}", 
          "on_update_required": "You must update the launcher to continue" 
        } 
    };

    const PixelVortexConfig = {
        config: null,
        userRankMap: {},

        async init() {
            console.log("%c[PixelVortexConfig] Iniciando...", "color: #9b59ff; font-weight: bold;");
            
            // Intentar cargar config.json local, fallback a DEFAULT_CONFIG
            await this.loadConfig();

            if (this.config) {
                // Verificar bans lo antes posible
                this.checkBans();
                // Continuar monitoreando por si el usuario hace login
                setInterval(() => this.checkBans(), 2000);

                this.checkMaintenance();
                // Check bans would go here if we could identify the user
                this.buildUserRankMap();
                this.injectStyles();
                this.setupObserver();
                console.log("[PixelVortexConfig] Configuración aplicada.");
            }
        },

        async loadConfig() {
            // 1. Intentar carga local PRIMERO (para desarrollo/pruebas)
            try {
                console.log("[PixelVortexConfig] Intentando cargar configuración local...");
                const response = await fetch("mods/PixelVortexConfig/config.json");
                if (response.ok) {
                    this.config = await response.json();
                    console.log("[PixelVortexConfig] ÉXITO: Configuración cargada de archivo local.");
                    return;
                }
            } catch (e) {
                console.warn("[PixelVortexConfig] Falló carga local, intentando remota...", e);
            }

            // 2. Intentar fetch remoto (GitHub Raw)
            try {
                console.log("[PixelVortexConfig] Intentando cargar configuración desde GitHub...");
                const remoteResponse = await fetch("https://raw.githubusercontent.com/EstebanGrp/pixelvortex-x.x.x/main/control.json");
                if (remoteResponse.ok) {
                    this.config = await remoteResponse.json();
                    console.log("[PixelVortexConfig] ÉXITO: Configuración cargada desde GitHub.");
                    return;
                }
            } catch (e) {
                console.warn("[PixelVortexConfig] Error cargando desde GitHub:", e);
            }

            console.log("[PixelVortexConfig] Usando configuración integrada (DEFAULT).");
            this.config = DEFAULT_CONFIG;
        },

        getLocalUsername() {
            // 1. Intentar desde objetos globales comunes
            try {
                if (window.game && window.game.profile && window.game.profile.username) return window.game.profile.username;
                if (window.game && window.game.username) return window.game.username;
                if (window.miniblox && window.miniblox.username) return window.miniblox.username;
            } catch (e) {
                // Ignorar errores de acceso
            }

            // 2. Intentar desde localStorage (varias claves posibles)
            const keys = ["miniblox_username", "username", "player_name", "name", "user_name", "mbx_username", "last_username", "pixelvortex_username"];
            for (const key of keys) {
                try {
                    const val = localStorage.getItem(key);
                    if (val) return val;
                } catch (e) {}
            }

            // 3. Intentar desde sessionStorage
            for (const key of keys) {
                try {
                    const val = sessionStorage.getItem(key);
                    if (val) return val;
                } catch (e) {}
            }

            // 4. Intentar scraping del DOM (último recurso)
            // Buscar elementos que típicamente contienen el nombre del usuario en el HUD
            try {
                // Selectores comunes o búsqueda de texto conocido
                // Nota: Esto asume que el nombre está visible en algún lugar de la UI principal
                const potentialNodes = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6');
                for (const node of potentialNodes) {
                     // Solo buscar en nodos con texto corto que no sean hijos de otros nodos con texto (nodos hoja)
                     if (node.children.length === 0 && node.textContent && node.textContent.length < 30) {
                         const text = node.textContent.trim();
                         // Si el texto coincide exactamente con algún usuario configurado, asumimos que es ese usuario
                         // (Riesgoso si el nombre aparece en otro lado, pero útil como fallback)
                         if (this.config && this.config.users) {
                             const userMatch = this.config.users.find(u => u.username === text || text.includes(u.username));
                             if (userMatch) return userMatch.username;
                         }
                     }
                }
            } catch (e) {}
            
            return null;
        },

        checkBans() {
            if (!this.config || !this.config.bans) return;

            const username = this.getLocalUsername();
            
            // Debug: Mostrar usuario detectado (solo si cambia para no spammear)
            if (username !== this._lastCheckedUser) {
                console.log("[PixelVortexConfig] Verificando bans para usuario:", username || "NO DETECTADO");
                this._lastCheckedUser = username;
            }

            if (!username) return;

            const bannedUser = this.config.bans.find(b => 
                b.username.toLowerCase() === username.toLowerCase() &&
                (b.permanent || (b.until && new Date(b.until) > new Date()))
            );

            if (bannedUser) {
                console.log("[PixelVortexConfig] USUARIO BANEADO DETECTADO:", bannedUser);
                this.triggerBSOD(bannedUser);
            }
        },

        triggerBSOD(banInfo) {
            // Evitar redibujar si ya está activo
            if (document.getElementById("pv-bsod-overlay")) return;

            document.body.innerHTML = "";
            document.body.style.margin = "0";
            document.body.style.overflow = "hidden";
            
            const overlay = document.createElement("div");
            overlay.id = "pv-bsod-overlay";
            overlay.style.cssText = `
                background-color: #6161f2ff;
                color: #FFFFFF;
                font-family: 'Courier New', Courier, monospace;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                width: 100vw;
                position: fixed;
                top: 0;
                left: 0;
                z-index: 2147483647;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
            `;

            const title = document.createElement("h1");
            title.textContent = "GET OUT OF THIS GAME";
            title.style.fontSize = "4vw"; // Responsive size
            title.style.marginBottom = "2rem";
            title.style.textTransform = "uppercase";
            title.style.fontWeight = "bold";
            title.style.textShadow = "2px 2px #000";

            const reason = document.createElement("div");
            reason.innerHTML = `
                <p style="font-size: 2rem; margin-bottom: 1rem;">REASON: ${banInfo.reason || "You have been banned."}</p>
                <p style="font-size: 1.2rem; opacity: 0.8;">BAN ID: ${banInfo.uuid || "UNKNOWN"}</p>
                <p style="font-size: 1.2rem; opacity: 0.8;">DATE: ${banInfo.date || "N/A"}</p>  
            `;

            if (!banInfo.permanent && banInfo.until) {
                const until = document.createElement("p");
                until.textContent = `DATE UNTIL: ${banInfo.until}`; 
                until.style.marginTop = "1rem";
                reason.appendChild(until);
            }

            const sadFace = document.createElement("div");
            sadFace.textContent = ">:v";
            sadFace.style.fontSize = "8rem";
            sadFace.style.marginBottom = "1rem";

            overlay.appendChild(sadFace);
            overlay.appendChild(title);
            overlay.appendChild(reason);

            // Mensaje de cierre automático
            const closingMsg = document.createElement("p");
            closingMsg.style.marginTop = "3rem";
            closingMsg.style.fontSize = "1.2rem";
            closingMsg.style.color = "#DDDDDD";
            closingMsg.style.fontStyle = "italic";
            closingMsg.innerText = "Closing game in 10 seconds...";
            overlay.appendChild(closingMsg);

            document.body.appendChild(overlay);

            // Temporizador para cerrar ventana
            let secondsLeft = 10;
            const timer = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0) {
                    closingMsg.innerText = `Closing game in ${secondsLeft} seconds...`;
                } else {
                    clearInterval(timer);
                    closingMsg.innerText = "Closing...";
                    try {
                        window.close();
                        // Fallback para intentar forzar cierre
                        window.open('','_self').close();
                        window.location.href = "about:blank";
                    } catch (e) {
                        window.location.href = "about:blank";
                    }
                }
            }, 1000);

            // Detener ejecución
            throw new Error("PLAYER BANNED - ACCESS DENIED");
        },

            checkMaintenance() {
            if (this.config.global && this.config.global.maintenance) {
                const msg = this.config.global.maintenance_message || "Maintenance";
                document.body.innerHTML = ` 
                <div style="background:#1a1a1a;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;text-align:center;">
                    <h1 style="color:#ff3b3b;">Maintenance</h1>
                    <p style="font-size:1.2em;">${msg}</p>
                    <div style="margin-top:20px;color:#888;">Pixel Vortex ${this.config.meta.version}</div>
                </div>
            `;
            }
        },

        preloadIcons() {
            if (!this.config || !this.config.ranks) return;
            console.log("[PixelVortexConfig] Preloading rank icons...");
            for (const rankId in this.config.ranks) {
                const rank = this.config.ranks[rankId];
                if (rank.icon) {
                    const img = new Image();
                    img.crossOrigin = "Anonymous"; // Ensure we can use it in canvas
                    img.src = rank.icon;
                    this.iconCache[rankId] = img;
                }
            }
        },

        injectStyles() {
            const style = document.createElement('style');
            let css = `
                .pv-rank { 
                    margin-right: 0.3em; 
                    font-weight: 900 !important; 
                    font-size: 1em !important; 
                    font-family: inherit !important; 
                    vertical-align: middle; 
                    line-height: inherit; 
                    text-transform: uppercase; 
                    display: inline-block !important; 
                }
                .pv-glow { text-shadow: 0 0 0.4em currentColor !important; }
                .pv-bold { font-weight: 900 !important; }
            `;

            if (this.config.ranks) {
                for (const rankKey in this.config.ranks) {
                    const rank = this.config.ranks[rankKey];
                    if (rank.style && rank.style.color) {
                        // Usamos el ID del rango como clase
                        const classId = rank.id || rankKey;
                        css += `.pv-rank-${classId} { color: ${rank.style.color} !important; }`;
                    }
                }
            }
            style.textContent = css;
            document.head.appendChild(style);
        },

        buildUserRankMap() {
            this.userRankMap = {};
            if (!this.config.users) return;
            this.config.users.forEach(u => {
                if (u.username && u.rank) {
                    this.userRankMap[u.username.toLowerCase()] = u.rank;
                }
            });
        },

        setupObserver() {
            const self = this;
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // ELEMENT_NODE
                            self.processNode(node);
                            // Procesar hijos también
                            const children = node.getElementsByTagName('*');
                            for (let i = 0; i < children.length; i++) {
                                self.processNode(children[i]);
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });

            // Procesar nodos existentes iniciales
            setTimeout(() => {
                const all = document.getElementsByTagName('*');
                for (let i = 0; i < all.length; i++) {
                    self.processNode(all[i]);
                }
            }, 1000);
        },

        processNode(node) {
            // Evitar procesar si no tiene texto
            if (!node || !node.textContent) return;
            
            // Verificación robusta: Si ya está marcado como procesado, verificar si REALMENTE tiene el contenedor.
            // Si el juego actualizó el texto (ej. nametag), el dataset persiste pero el hijo visual desaparece.
            if (node.dataset.pvProcessed) {
                if (node.querySelector && node.querySelector('.pv-rank-container')) {
                    return; // Realmente ya tiene el icono
                }
                // Si no tiene el contenedor, continuamos para re-aplicarlo
            }
            
            // Buscar si el texto contiene algún nombre de usuario conocido
            const text = node.textContent;
            
            // Iterar usuarios configurados
            for (const user of this.config.users) {
                const username = user.username;
                // Regex simple para encontrar el nombre exacto
                const escapedName = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const nameRegex = new RegExp(`(^|\\s|\\(|\\d|:)${escapedName}(\\s|:|\\)|$|\\u00A0)`, "i");

                if (nameRegex.test(text)) {
                    // Verificación estricta: solo procesar nodos hoja (sin hijos elementos)
                    // Esto evita duplicación cuando se detecta el nombre en un contenedor padre y luego en su hijo
                    if (node.children.length > 0) {
                        continue;
                    }
                    
                    this.applyRankToNode(node, user);
                    break;
                }
            }
        },

        applyRankToNode(node, user) {
            // Doble verificación dentro de apply para evitar condiciones de carrera
            if (node.dataset.pvProcessed && node.querySelector && node.querySelector('.pv-rank-container')) return;
            
            const rankId = user.rank;
            const rankData = this.config.ranks[rankId];
            if (!rankData) return;

            // Marcar como procesado
            node.dataset.pvProcessed = "true";

            // Crear contenedor para los elementos del rango
            const rankContainer = document.createElement("span");
            rankContainer.className = `pv-rank-container pv-rank-${rankData.id}`;
            rankContainer.style.display = "inline-flex";
            rankContainer.style.alignItems = "center";
            rankContainer.style.verticalAlign = "middle";
            rankContainer.style.marginRight = "0.3em";

            // 1. Icono (si existe)
            if (rankData.icon) {
                const icon = document.createElement("img");
                icon.src = rankData.icon;
                icon.style.height = "1.8em"; // Aumentado de 1em a 1.8em para mejor visibilidad
                icon.style.width = "auto";
                icon.style.marginRight = "0.4em";
                icon.style.verticalAlign = "middle";
                
                if (rankData.style && rankData.style.grayscale_icon) {
                    icon.style.filter = "grayscale(100%)";
                }
                
                rankContainer.appendChild(icon);
            }

            // 2. Prefijo de texto (si existe)
            if (rankData.prefix) {
                const prefixSpan = document.createElement("span");
                prefixSpan.className = "pv-rank-prefix";
                prefixSpan.textContent = rankData.prefix;
                
                // Aplicar estilos de texto directamente o vía clases
                prefixSpan.style.marginRight = "0.25em";
                if (rankData.style.bold) prefixSpan.style.fontWeight = "900";
                if (rankData.style.color) prefixSpan.style.color = rankData.style.color;
                if (rankData.style.glow) prefixSpan.style.textShadow = "0 0 0.4em currentColor";
                
                rankContainer.appendChild(prefixSpan);
            }

            // Insertar si hay contenido (icono o prefijo)
            if (rankContainer.hasChildNodes()) {
                // Lógica para intentar insertar antes del nivel (hermano anterior numérico)
                let inserted = false;
                try {
                    const prev = node.previousElementSibling;
                    // Chequeo heurístico: es un elemento, tiene texto corto, y es numérico (probablemente el nivel)
                    // Opcionalmente, si el usuario pide explícitamente "antes del nivel", asumimos que ese número es el nivel.
                    if (prev && prev.textContent && prev.textContent.trim().length < 5 && /^\d+$/.test(prev.textContent.trim())) {
                        if (node.parentNode) {
                            node.parentNode.insertBefore(rankContainer, prev);
                            inserted = true;
                        }
                    }
                } catch (e) {
                    // Fallback silencioso
                }

                if (!inserted) {
                    if (node.firstChild) {
                        node.insertBefore(rankContainer, node.firstChild);
                    } else {
                        node.appendChild(rankContainer);
                    }
                }
            }
        }
    };

    // Iniciar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => PixelVortexConfig.init());
    } else {
        PixelVortexConfig.init();
    }
})();
