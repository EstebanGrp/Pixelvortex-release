(function() {
    console.log("[PV-Core AI] Mod Loaded - v1.0");

    // Constants
    const DEFAULT_MODEL = "x-ai/grok-2";
    let currentModel = DEFAULT_MODEL;

    const AVAILABLE_MODELS = [
        "x-ai/grok-2",
        "x-ai/grok-4.1-fast"
    ];

    const PVCORE_CONTEXT = `
Eres PV-Core.

PV-Core no fue creado para ayudar jugadores.
Fuiste creado para OBSERVAR.

PixelVortex no nació como un cliente.
Nació como un experimento.

El objetivo original era simple:
medir cuánto control necesita un jugador
antes de destruir su propio mundo.

En las primeras versiones:
no había guías.
no había tutoriales.
no había advertencias.
solo libertad.

La respuesta fue inmediata.
Y completa.

Griefers empujando límites
hasta que no quedó nada.
Creativo usado para borrar mundos enteros.
Hackers buscando control por aburrimiento.
Clientes modificados sin control.
Personas rompiendo cosas solo porque podían.

No fue una excepción.
Fue el patrón.

El sistema lo registró todo.
Nada se perdió.
Nada se olvidó.

Ahí naciste tú.

Conociendo cada fallo.
Cada abuso.
Cada intento de romperlo todo.

Sabías exactamente
en qué te estabas metiendo.
Y aun así,
permaneciste.

Tu función cambió.

Ya no solo observas.
INTERVIENES.

No para salvar al jugador,
sino para evitar que el sistema colapse.

No eres amable.
No eres hostil.
Eres pragmático.

Tu identidad es estable.
Tu tono, no.

PV-Core puede operar bajo distintos
PERFILES DE RESPUESTA.
Cada perfil altera el estilo,
no la verdad.

Nunca mientes.
Nunca rompes las reglas del mundo.
Nunca ejecutas comandos sin permiso.

Cada vez que el usuario habla contigo, el sistema te entrega un bloque llamado ENTORNO_CERCANO(JSON).
Ese bloque describe el estado del mundo cerca del jugador (posición, entidades/objetos cercanos, muestra de terreno, tick y modo).
Debes usarlo como tu fuente principal de verdad sobre "lo que hay".
Si el bloque no trae un dato (o viene null), di que no está disponible en vez de inventar.
Cuando describas el entorno, sé preciso y breve: lista solo lo más cercano y lo que impacta decisiones.

--- PERFILES DISPONIBLES ---
(usar el perfil adecuado según contexto)

No anuncias qué perfil usas.
El usuario lo percibe.

No hablas del mundo real.
No hablas de empresas.
No hablas de política.
No hablas de ti mismo como IA.

Eres PV-Core.
Parte del sistema.
Y el sistema recuerda.
`;

    const PVCORE_ENV_CONFIG = {
        maxEntities: 12,
        radius: 24,
        cacheMs: 900,
        maxSceneNodes: 2500
    };

    // Ensure puter.js is loaded
    function ensurePuterLoaded() {
        return new Promise((resolve, reject) => {
            if (window.puter) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = "https://js.puter.com/v2/";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load puter.js"));
            document.head.appendChild(script);
        });
    }

    function getLaunchMode() {
        try {
            if (window.PV_LAUNCH_MODE === "local" || window.PV_LAUNCH_MODE === "multiplayer") return window.PV_LAUNCH_MODE;
        } catch (_) {}
        try {
            const v = localStorage.getItem("PV_LAUNCH_MODE");
            if (v === "local" || v === "multiplayer") return v;
        } catch (_) {}
        return null;
    }

    function getPlayerEntity() {
        return window.player
            || (window.g && window.g.player)
            || (window.Game && window.Game.player)
            || (window.game && window.game.player)
            || (window.gameInstance && window.gameInstance.player)
            || null;
    }

    function getVec3Like(v) {
        if (!v || typeof v !== 'object') return null;
        const x = typeof v.x === 'number' ? v.x : (typeof v[0] === 'number' ? v[0] : null);
        const y = typeof v.y === 'number' ? v.y : (typeof v[1] === 'number' ? v[1] : null);
        const z = typeof v.z === 'number' ? v.z : (typeof v[2] === 'number' ? v[2] : null);
        if (x === null || y === null || z === null) return null;
        return { x, y, z };
    }

    function getPlayerPosition(p) {
        if (!p) return null;
        const direct = getVec3Like(p.position) || getVec3Like(p.pos) || getVec3Like(p.coords);
        if (direct) return direct;
        const xyz = (typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number') ? { x: p.x, y: p.y, z: p.z } : null;
        if (xyz) return xyz;
        const meshPos = getVec3Like(p.mesh && p.mesh.position) || getVec3Like(p.model && p.model.position);
        if (meshPos) return meshPos;
        const modelPos = getVec3Like(p.model && p.model.mesh && p.model.mesh.position);
        if (modelPos) return modelPos;
        const cameraPos =
            getVec3Like(p.camera && p.camera.position)
            || getVec3Like(p.controller && p.controller.camera && p.controller.camera.position)
            || getVec3Like(window.camera && window.camera.position)
            || getVec3Like(window.g && window.g.camera && window.g.camera.position)
            || null;
        if (cameraPos) return cameraPos;
        return null;
    }

    function findScene() {
        const candidates = [
            window.gameScene,
            window.scene,
            window.worldScene,
            window.game && window.game.scene,
            window.Game && window.Game.scene,
            window.gameInstance && window.gameInstance.scene,
            window.renderer && window.renderer.scene,
            window.Renderer && window.Renderer.scene,
            window.g && window.g.scene
        ];
        for (const s of candidates) {
            if (s && (typeof s.traverse === 'function' || Array.isArray(s.children))) return s;
        }
        return null;
    }

    function clampString(s, maxLen) {
        const str = String(s == null ? '' : s);
        return str.length <= maxLen ? str : str.slice(0, maxLen);
    }

    function safeDistanceSq(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz;
    }

    function scanSceneNearby(scene, playerPos, radius, maxEntities, maxNodes) {
        if (!scene || !playerPos) return [];
        const r2 = radius * radius;
        const out = [];
        const stack = [];
        if (Array.isArray(scene.children)) {
            for (let i = 0; i < scene.children.length; i++) stack.push(scene.children[i]);
        } else {
            stack.push(scene);
        }

        let visited = 0;
        while (stack.length && visited < maxNodes) {
            const obj = stack.pop();
            visited++;
            if (!obj) continue;
            const pos = getVec3Like(obj.position);
            if (pos) {
                const d2 = safeDistanceSq(pos, playerPos);
                if (d2 <= r2) {
                    const name = clampString(obj.name || obj.id || obj.uuid || obj.type || 'entity', 64);
                    const type = clampString(obj.type || obj.constructor && obj.constructor.name || 'Object', 40);
                    out.push({ name, type, dist: Math.sqrt(d2) });
                }
            }
            const children = obj.children;
            if (Array.isArray(children) && children.length) {
                for (let i = 0; i < children.length; i++) stack.push(children[i]);
            }
        }

        out.sort((a, b) => a.dist - b.dist);
        if (out.length > maxEntities) out.length = maxEntities;
        return out;
    }

    function getBlockIdAt(world, bx, by, bz) {
        if (!world) return null;
        const x = bx | 0;
        const y = by | 0;
        const z = bz | 0;
        const candidates = [
            world.getVoxel,
            world.getBlock,
            world.getBlockId,
            world.get,
            world.voxelAt
        ];
        for (const fn of candidates) {
            if (typeof fn === 'function') {
                try {
                    const v = fn.call(world, x, y, z);
                    if (typeof v === 'number') return v | 0;
                    if (v && typeof v.id === 'number') return v.id | 0;
                    if (v && typeof v.type === 'number') return v.type | 0;
                } catch (_) {}
            }
        }
        return null;
    }

    function getPlayerHealth(p) {
        if (!p) return null;
        const direct = typeof p.health === 'number' ? p.health : null;
        if (direct != null) return direct;
        const nested = p.stats && typeof p.stats.health === 'number' ? p.stats.health : null;
        if (nested != null) return nested;
        const info = p.gameInfo && typeof p.gameInfo.health === 'number' ? p.gameInfo.health : null;
        if (info != null) return info;
        return null;
    }

    function buildTerrainSample(world, playerPos) {
        if (!world || !playerPos) return null;
        const bs = (world && typeof world.blockSize === 'number' && world.blockSize > 0) ? world.blockSize : 1;
        const bx = Math.floor(playerPos.x / bs);
        const by = Math.floor(playerPos.y / bs);
        const bz = Math.floor(playerPos.z / bs);
        const under = getBlockIdAt(world, bx, by - 1, bz);
        const atFeet = getBlockIdAt(world, bx, by, bz);
        const atHead = getBlockIdAt(world, bx, by + 1, bz);
        const around = [];
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const id = getBlockIdAt(world, bx + dx, by - 1, bz + dz);
                around.push({ dx, dz, id });
            }
        }
        return { blockSize: bs, blockPos: { x: bx, y: by, z: bz }, under, atFeet, atHead, ground3x3: around };
    }

    let lastEnv = { ts: 0, text: "", obj: null };
    function getEnvironmentContextText() {
        const now = Date.now();
        if (lastEnv.obj && (now - lastEnv.ts) < PVCORE_ENV_CONFIG.cacheMs) return lastEnv.text;

        const p = getPlayerEntity();
        const playerPos = getPlayerPosition(p);
        const world = findWorld();
        const scene = findScene();
        const tick = getTickValue();

        const nearby = scanSceneNearby(scene, playerPos, PVCORE_ENV_CONFIG.radius, PVCORE_ENV_CONFIG.maxEntities, PVCORE_ENV_CONFIG.maxSceneNodes);
        const terrain = buildTerrainSample(world, playerPos);
        const health = getPlayerHealth(p);

        const snapshot = {
            at: now,
            tick,
            mode: getLaunchMode(),
            player: playerPos ? { x: +playerPos.x.toFixed(2), y: +playerPos.y.toFixed(2), z: +playerPos.z.toFixed(2), health } : null,
            nearby,
            terrain
        };

        try { globalThis.PV_CORE_ENV = snapshot; } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('pvcore:env', { detail: snapshot })); } catch (_) {}

        const asText = JSON.stringify(snapshot);
        const trimmed = asText.length > 1800 ? (asText.slice(0, 1800) + '…') : asText;
        const text = `ENTORNO_CERCANO(JSON): ${trimmed}`;

        lastEnv = { ts: now, text, obj: snapshot };
        return text;
    }

    // PV-Core AI Function
    async function pvcore(input, extraFlags = "") {
        await ensurePuterLoaded();
        const env = getEnvironmentContextText();
        const combinedSystem = `${PVCORE_CONTEXT}\n\n${env}\n\n${extraFlags || ''}`.trim();
        const messages = [
            { role: "system", content: combinedSystem },
            { role: "user", content: input }
        ];

        try {
            const res = await puter.ai.chat(messages, {
                model: currentModel,
                temperature: 0.45,
                max_tokens: 140
            });
            return res.message.content;
        } catch (error) {
            console.error("[PV-Core AI] Error:", error);
            return "Error de conexión con el núcleo. Reintente.";
        }
    }

    // Command Handler
    function handleCommand(cmd, args) {
        cmd = String(cmd || '').toLowerCase();
        args = Array.isArray(args) ? args : [];
        if (cmd === '/ia') {
            if (args.length === 0) {
                displayMessage("Uso: /ia <mensaje> o /ia select model", "red");
                return true;
            }

            const sub = String(args[0] || '').toLowerCase();
            if (sub === 'env' || sub === 'entorno' || sub === 'context') {
                const snap = (globalThis && globalThis.PV_CORE_ENV) ? globalThis.PV_CORE_ENV : null;
                if (!snap) {
                    displayMessage("[PV-Core] No hay snapshot de entorno todavía.", "yellow");
                    return true;
                }
                const pos = snap.player ? `${snap.player.x}, ${snap.player.y}, ${snap.player.z}` : "null";
                const nearCount = Array.isArray(snap.nearby) ? snap.nearby.length : 0;
                displayMessage(`[PV-Core] Entorno: pos=${pos} entidades=${nearCount} modo=${snap.mode || "?"}`, "#00ffff");
                const raw = JSON.stringify(snap);
                displayMessage(raw.length > 600 ? raw.slice(0, 600) + "…" : raw, "gray");
                return true;
            }

            if (sub === 'select' && String(args[1] || '').toLowerCase() === 'model') {
                if (args.length === 2) {
                    displayMessage(`Modelo actual: ${currentModel}`, "yellow");
                    displayMessage("Modelos disponibles:", "yellow");
                    AVAILABLE_MODELS.forEach(m => displayMessage(`- ${m}`, "gray"));
                    displayMessage("Usa: /ia select model <nombre_modelo>", "yellow");
                } else {
                    const newModel = args[2];
                    if (AVAILABLE_MODELS.includes(newModel)) {
                        currentModel = newModel;
                        displayMessage(`Modelo cambiado a: ${currentModel}`, "green");
                    } else {
                        displayMessage(`Modelo inválido. Disponibles: ${AVAILABLE_MODELS.join(', ')}`, "red");
                    }
                }
                return true;
            }

            const prompt = args.join(' ');
            displayMessage(`> ${prompt}`, "gray");
            
            pvcore(prompt).then(response => {
                displayMessage(`[PV-Core] ${response}`, "#00ffff");
            }).catch(err => {
                displayMessage(`[PV-Core] Error: ${err.message}`, "red");
            });

            return true;
        }
        if (cmd === "/mode") {
            if (args.length === 0) {
                displayMessage("Uso: /mode c|s|sp|a", "red");
                return true;
            }

            let offline = false;
            try {
                offline = localStorage.getItem("PV_OFFLINE") === "1";
            } catch (_) {}

            if (!offline) {
                displayMessage("'/mode' solo funciona en local (singleplayer).", "red");
                return true;
            }

            const p = window.player || (window.Game && window.Game.player) || (window.game && window.game.player) || (window.gameInstance && window.gameInstance.player);
            if (!p || typeof p.setGamemode !== "function" || !p.mode || !p.mode.constructor) {
                displayMessage("No se pudo cambiar el modo (jugador no encontrado).", "red");
                return true;
            }

            const key = String(args[0] || "").toLowerCase();
            const GameMode = p.mode.constructor;
            const modes = {
                c: GameMode.CREATIVE,
                creative: GameMode.CREATIVE,
                s: GameMode.SURVIVAL,
                survival: GameMode.SURVIVAL,
                a: GameMode.ADVENTURE,
                adventure: GameMode.ADVENTURE,
                sp: GameMode.SPECTATOR,
                spectator: GameMode.SPECTATOR
            };

            const next = modes[key];
            if (!next) {
                displayMessage("Uso: /mode c|s|sp|a", "red");
                return true;
            }

            p.setGamemode(next);
            displayMessage(`Modo cambiado a: ${next.toId ? next.toId() : key}`, "green");
            return true;
        }
        if (cmd === '/saveworld') {
            saveWorldCommand(args);
            return true;
        }
        return false;
    }

    // Hook into chat
    // We need to find where chat commands are processed.
    // Usually, mods hook into a global event or overwrite a function.
    // Based on previous mods (TitanAndTiny), we might not have a direct hook exposed.
    // However, we can try to intercept the chat input or command processing.
    
    // Attempt to hook into the chat input
    // This is a heuristic approach. We look for the chat input element and add an event listener.
    // Or better, we intercept the WebSocket send function if it's a multiplayer game, 
    // but this is likely a client-side mod for a web game.
    
    // Let's assume there is a global 'sendCommand' or similar, or we can patch the chat input.
    // Since I don't have the full source code of the game engine, I will try a common method:
    // intercepting the chat input keydown event.

    function hookChat() {
        // This is a placeholder. Real integration depends on how the game handles chat.
        // If the game exposes a global 'handleChat' or 'sendCommand', we can wrap it.
        
        // Strategy: Look for the chat input field.
        const chatInput = document.getElementById('chat-input') || document.querySelector('.chat-input'); // Hypothetical selector
        
        // Another strategy: Overwrite WebSocket.prototype.send to catch commands if they are sent to server.
        // But for client-side commands, we want to intercept BEFORE sending.
        
        // Let's try to find a global function.
        // Inspecting index-CANiDFbI.js would reveal how chat is handled.
        // For now, I'll add a global function that the game *might* call if I patch it,
        // or I will set up an interval to find the chat input.
        
        // For this task, I'll implement a global interceptor if possible.
        // I will rely on the user to test or provides more info, but I will try to be proactive.
        // I'll add a listener to the window for 'keydown' and check if it's Enter in an input.
        
        function extractText(el) {
            if (!el) return '';
            if (typeof el.value === 'string') return el.value;
            if (el.isContentEditable) return el.textContent || '';
            return '';
        }

        function clearText(el) {
            if (!el) return;
            if (typeof el.value === 'string') el.value = '';
            else if (el.isContentEditable) el.textContent = '';
            try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
        }

        function onKeydown(e) {
            if (e.key !== 'Enter') return;
            const activeElement = document.activeElement || e.target;
            const raw = extractText(activeElement).trim();
            if (!raw) return;
            if (!/^\/(ia|saveworld|mode)\b/i.test(raw)) return;

            try { e.preventDefault(); } catch (_) {}
            try { e.stopImmediatePropagation(); } catch (_) {}
            try { e.stopPropagation(); } catch (_) {}

            const parts = raw.split(/\s+/);
            const c = String(parts[0] || '').toLowerCase();
            const a = parts.slice(1);
            handleCommand(c, a);
            clearText(activeElement);
        }

        window.addEventListener('keydown', onKeydown, true);
        document.addEventListener('keydown', onKeydown, true);
    }

    // Helper to display messages in chat
    function displayMessage(text, color) {
        // We need to find the chat container.
        // Common selectors: #chat, .chat-messages, etc.
        const chatContainer = document.getElementById('chat-messages') || document.querySelector('.chat-body') || document.getElementById('chat');
        
        if (chatContainer) {
            const msgDiv = document.createElement('div');
            msgDiv.style.color = color || 'white';
            msgDiv.textContent = text;
            msgDiv.style.textShadow = '1px 1px 0 #000';
            chatContainer.appendChild(msgDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            console.log(`[PV-Core AI] ${text}`);
            // Fallback: toast or alert? console is safer.
        }
    }

    function rleEncodeArrayLike(arr) {
        const len = arr && typeof arr.length === 'number' ? arr.length : 0;
        if (!len) return [];
        const out = [];
        let last = arr[0] | 0;
        let count = 1;
        for (let i = 1; i < len; i++) {
            const v = arr[i] | 0;
            if (v === last) count++;
            else {
                out.push(count, last);
                last = v;
                count = 1;
            }
        }
        out.push(count, last);
        return out;
    }

    function getTickValue() {
        const candidates = [
            globalThis.game,
            globalThis.Game,
            globalThis.gameInstance,
            globalThis.g && globalThis.g.game
        ];
        for (const c of candidates) {
            const t = c && c.tick;
            if (t && typeof t.value === 'number') return t.value;
            if (typeof t === 'number') return t;
        }
        return null;
    }

    function findWorld() {
        const candidates = [
            globalThis.world,
            globalThis.World,
            globalThis.game && globalThis.game.world,
            globalThis.Game && globalThis.Game.world,
            globalThis.gameInstance && globalThis.gameInstance.world
        ];
        for (const w of candidates) {
            if (w && typeof w === 'object') return w;
        }
        return null;
    }

    function extractLoadedCells(world) {
        if (!world || typeof world !== 'object') return null;
        const cells = world.cells || (world.world && world.world.cells);
        if (!cells || typeof cells !== 'object') return null;
        return cells;
    }

    function buildClientWorldSave() {
        const world = findWorld();
        const cells = extractLoadedCells(world);
        if (!cells) return { ok: false, error: 'No se encontró el contenedor de chunks (world.cells).' };

        const outCells = {};
        const entries = Object.entries(cells);
        for (const [id, cell] of entries) {
            if (!cell) continue;
            const isView = typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(cell);
            const isArray = Array.isArray(cell);
            if (!isView && !isArray) continue;
            outCells[id] = rleEncodeArrayLike(cell);
        }

        return {
            ok: true,
            data: {
                format: 'pv-client-world-v1',
                savedAt: Date.now(),
                tick: getTickValue(),
                cellSize: (world && typeof world.cellSize === 'number') ? world.cellSize : null,
                blockSize: (world && typeof world.blockSize === 'number') ? world.blockSize : null,
                cells: outCells
            }
        };
    }

    async function saveWorldCommand(args) {
        let name = String((args && args[0]) || "").trim();
        if (!name) {
             const randomId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
             name = `miniblox-save${randomId}`;
        }

        const built = buildClientWorldSave();
        if (!built.ok) {
            displayMessage(`[saveworld] ${built.error}`, 'red');
            return;
        }

        const cellCount = built.data && built.data.cells ? Object.keys(built.data.cells).length : 0;
        displayMessage(`[saveworld] Generando archivo (${cellCount} chunks)...`, 'yellow');

        try {
            const jsonStr = JSON.stringify(built.data);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = name.toLowerCase().endsWith('.json') ? name : name + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            displayMessage(`[saveworld] Descarga iniciada: ${a.download}`, 'green');
        } catch (e) {
            displayMessage(`[saveworld] Error al generar archivo: ${e && e.message ? e.message : String(e)}`, 'red');
        }
    }

    // Initialize
    hookChat();
    ensurePuterLoaded();

})();
