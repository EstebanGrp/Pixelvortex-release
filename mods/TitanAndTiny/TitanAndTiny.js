(function() {
    console.log("[TitanAndTiny] Mod Loaded - v1.1 (Multiplayer Support)");

    const CONFIG = {
        minScale: 0.05,
        maxScale: 20.0,
        defaultScale: 1.0,
        baseWidth: 0.6,
        baseHeight: 1.8,
        eyeFactor: 0.92,
        sneakOffset: 0.1875
    };

    let playerScale = CONFIG.defaultScale;
    let uiVisible = false;
    
    // Map to store specific scales for other players: name -> scale
    const individualScales = new Map();

    // Helper to refresh the UI list
    function refreshRemoteList() {
        const listContainer = document.getElementById('titan-remote-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        if (individualScales.size === 0) {
            listContainer.innerHTML = '<div style="color: #666; font-style: italic; padding: 5px;">No custom sizes set.</div>';
            return;
        }

        individualScales.forEach((scale, name) => {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                background: #333; padding: 5px 10px; margin-bottom: 4px;
                border: 1px solid #555; border-radius: 4px; font-size: 14px;
            `;
            
            item.innerHTML = `
                <span style="color: #fff;">${name}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #00ffff; font-weight: bold;">${scale.toFixed(2)}x</span>
                    <button class="remove-btn" data-name="${name}" style="
                        background: #ff4444; border: none; color: white; cursor: pointer;
                        padding: 2px 6px; border-radius: 3px; font-weight: bold;
                    ">X</button>
                </div>
            `;
            
            item.querySelector('.remove-btn').onclick = (e) => {
                const n = e.target.getAttribute('data-name');
                individualScales.delete(n);
                refreshRemoteList();
            };
            
            listContainer.appendChild(item);
        });
    }

    // --- Public API ---
    window.setPlayerSize = function(nameOrPartial, scale) {
        if (!nameOrPartial) return;
        const s = parseFloat(scale);
        if (isNaN(s)) {
            console.error("[TitanAndTiny] Invalid scale:", scale);
            return;
        }
        individualScales.set(nameOrPartial.toLowerCase(), s);
        console.log(`[TitanAndTiny] Set size for '${nameOrPartial}' to ${s}x`);
        refreshRemoteList();
    };

    window.clearPlayerSizes = function() {
        individualScales.clear();
        console.log("[TitanAndTiny] Cleared all individual player sizes.");
        refreshRemoteList();
    };
    
    window.listPlayerSizes = function() {
        console.log("[TitanAndTiny] Individual Sizes:", Object.fromEntries(individualScales));
    };
    // ------------------

    function injectSettingsButton() {
        const keywords = ["Video Settings", "Graphics", "Configuración de Video", "Gráficos", "FOV", "Render Distance"];
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        
        let targetContainer = null;
        let referenceBtn = null;

        for (const btn of buttons) {
            if (btn.innerText && keywords.some(k => btn.innerText.includes(k))) {
                referenceBtn = btn;
                targetContainer = btn.parentElement;
                break;
            }
        }

        if (targetContainer && !document.getElementById('titan-tiny-entry-btn')) {
            const btn = document.createElement('button');
            btn.id = 'titan-tiny-entry-btn';
            btn.innerText = 'Titan & Tiny';
            if (referenceBtn) {
                btn.className = referenceBtn.className;
                btn.style.cssText = referenceBtn.style.cssText;
            }
            btn.style.marginTop = '5px';
            btn.style.marginBottom = '5px';
            btn.style.width = '100%';
            btn.style.backgroundColor = '#ffaa00';
            btn.style.color = 'black';
            btn.style.fontWeight = 'bold';
            btn.style.fontFamily = 'Faithful, sans-serif'; 
            btn.style.textShadow = 'none';
            
            btn.onclick = () => {
                togglePanel();
            };
            
            targetContainer.appendChild(btn);
            console.log("[TitanAndTiny] Settings Button Injected");
        }
    }

    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'titan-tiny-panel';
        panel.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85); 
            display: none; z-index: 2147483647; 
            flex-direction: column; align-items: center; justify-content: center;
            font-family: 'Faithful', sans-serif; color: white;
            backdrop-filter: blur(2px);
        `;
        
        const oldPanel = document.getElementById('titan-tiny-panel');
        if (oldPanel) oldPanel.remove();

        const btnStyle = `
            width: 150px; padding: 10px; cursor: pointer; margin: 5px;
            background: #222; color: white; border: 2px solid #555; 
            font-family: 'Faithful', sans-serif; font-size: 16px;
            text-shadow: 1px 1px 0 #000; box-shadow: 0 4px 0 #000;
            position: relative; top: 0; transition: top 0.1s, box-shadow 0.1s;
        `;

        panel.innerHTML = `
            <h2 style="font-size: 32px; margin-bottom: 20px; text-shadow: 3px 3px 0 #000; color: #ffaa00;">Titan & Tiny</h2>
            <div id="titan-preview-area" style="
                width: 200px; height: 200px; 
                background: #1a1a1a; border: 2px solid #555;
                position: relative; overflow: hidden;
                margin-bottom: 20px;
                display: flex; justify-content: center; align-items: flex-end;
                box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
            ">
                <div style="
                    position: absolute; width: 100%; height: 100%;
                    background-image: linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px);
                    background-size: 20px 20px; opacity: 0.3;
                "></div>

                <div style="
                    width: 32px; height: 64px;
                    position: absolute; bottom: 20px;
                    pointer-events: none;
                    display: flex; flex-direction: column; align-items: center;
                    opacity: 0.3; filter: grayscale(100%);
                ">
                     <div style="width: 8px; height: 8px; background: #FFCC99;"></div>
                     <div style="width: 8px; height: 12px; background: #00AAAA;"></div>
                     <div style="width: 8px; height: 12px; background: #0000AA;"></div>
                     <div style="position: absolute; top: -15px; font-size: 8px; color: #fff;">1x</div>
                </div>
                <div id="titan-preview-player" style="
                    width: 32px; height: 64px;
                    position: absolute; bottom: 20px;
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    transform-origin: bottom center;
                    display: flex; flex-direction: column; align-items: center;
                ">
                     <div style="width: 8px; height: 8px; background: #FFCC99; border: 1px solid rgba(0,0,0,0.2);">
                        <div style="width: 2px; height: 2px; background: #FFF; margin: 2px 1px 0 1px; display: inline-block;"></div>
                        <div style="width: 2px; height: 2px; background: #FFF; margin: 2px 1px 0 1px; display: inline-block;"></div>
                     </div>
                     <div style="width: 8px; height: 12px; background: #00AAAA; border: 1px solid rgba(0,0,0,0.2);"></div>
                     <div style="display: flex; width: 8px; height: 12px;">
                        <div style="width: 4px; height: 12px; background: #0000AA; border: 1px solid rgba(0,0,0,0.2);"></div>
                        <div style="width: 4px; height: 12px; background: #0000AA; border: 1px solid rgba(0,0,0,0.2);"></div>
                     </div>
                </div>
                <div style="position: absolute; top: 5px; left: 5px; color: #aaa; font-size: 10px; font-family: sans-serif;">Size Preview</div>
            </div>

            <div style="margin-bottom: 30px; text-align: center; width: 80%; max-width: 600px;">
                <div id="titan-scale-display" style="font-size: 48px; font-weight: bold; color: #00ffff; margin-bottom: 10px; text-shadow: 3px 3px 0 #000;">1.00x</div>
                <input type="range" id="titan-slider" min="${CONFIG.minScale}" max="${CONFIG.maxScale}" step="0.05" value="1.0" style="
                    width: 100%; cursor: pointer; height: 20px; accent-color: #ffaa00;
                ">
            </div>

            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
                <button class="preset-btn" data-val="0.1" style="${btnStyle}">Micro (0.1x)</button>
                <button class="preset-btn" data-val="1.0" style="${btnStyle}">Normal (1.0x)</button>
                <button class="preset-btn" data-val="5.0" style="${btnStyle}">Giant (5.0x)</button>
                <button class="preset-btn" data-val="20.0" style="${btnStyle}; border-color: #ff0000; color: #ffcccc;">TITAN (20x)</button>
            </div>

            <div style="width: 80%; max-width: 500px; border-top: 1px solid #444; margin-bottom: 20px; padding-top: 10px;">
                <h3 style="text-align: center; color: #ffaa00; margin: 0 0 10px 0; font-size: 18px;">Remote Players</h3>
                
                <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                    <input id="titan-remote-name" type="text" placeholder="Name" style="
                        flex: 1; padding: 5px; background: #222; border: 1px solid #555; color: white; font-family: inherit;
                    ">
                    <input id="titan-remote-scale" type="number" placeholder="Scale" step="0.1" value="1.0" style="
                        width: 60px; padding: 5px; background: #222; border: 1px solid #555; color: white; font-family: inherit;
                    ">
                    <button id="titan-add-remote" style="
                        padding: 5px 10px; background: #00aa00; color: white; border: 1px solid #00ff00; cursor: pointer; font-family: inherit;
                    ">Set</button>
                </div>

                <div id="titan-remote-list" style="
                    max-height: 100px; overflow-y: auto; background: #111; border: 1px solid #333; border-radius: 4px; padding: 5px;
                ">
                    <!-- Dynamic List -->
                </div>
                 <div style="text-align: right; margin-top: 5px;">
                    <button id="titan-clear-remote" style="
                        font-size: 10px; background: #444; color: #aaa; border: none; padding: 3px 6px; cursor: pointer;
                    ">Clear All</button>
                </div>
            </div>

            <div style="margin-top: 5px;">
                <button id="titan-close" style="
                    width: 200px; padding: 12px; cursor: pointer;
                    background: #444; color: white; border: 2px solid #fff; 
                    font-family: 'Faithful', sans-serif; font-size: 18px;
                    text-shadow: 2px 2px 0 #000; box-shadow: 0 4px 0 #000;
                ">Done</button>
            </div>
            
            <div style="position: absolute; bottom: 20px; font-size: 12px; color: #888;">Changes hitbox & camera instantly.</div>
        `;

        document.body.appendChild(panel);

        const slider = document.getElementById('titan-slider');
        const display = document.getElementById('titan-scale-display');
        const previewPlayer = document.getElementById('titan-preview-player');

        const updateVal = (val) => {
            playerScale = parseFloat(val);
            slider.value = playerScale;
            display.innerText = playerScale.toFixed(2) + 'x';
            window.MOD_PLAYER_SCALE = playerScale; 
            if (previewPlayer) {
                previewPlayer.style.transform = `scale(${playerScale})`;
            }
        };

        slider.oninput = (e) => updateVal(e.target.value);

        panel.querySelectorAll('.preset-btn').forEach(btn => {
            btn.onmousedown = () => { btn.style.top = '4px'; btn.style.boxShadow = '0 0 0 #000'; };
            btn.onmouseup = () => { btn.style.top = '0'; btn.style.boxShadow = '0 4px 0 #000'; };
            btn.onmouseout = () => { btn.style.top = '0'; btn.style.boxShadow = '0 4px 0 #000'; };
            
            btn.onclick = () => updateVal(btn.getAttribute('data-val'));
        });

        // Remote Player UI Logic
        const nameInput = document.getElementById('titan-remote-name');
        const scaleInput = document.getElementById('titan-remote-scale');
        const addBtn = document.getElementById('titan-add-remote');
        const clearBtn = document.getElementById('titan-clear-remote');

        addBtn.onclick = () => {
            const name = nameInput.value.trim();
            const scale = scaleInput.value;
            if (name && scale) {
                window.setPlayerSize(name, scale);
                nameInput.value = '';
            }
        };

        clearBtn.onclick = () => {
            window.clearPlayerSizes();
        };

        // Initial populate
        refreshRemoteList();
        
        const closeBtn = document.getElementById('titan-close');
        closeBtn.onmousedown = () => { closeBtn.style.top = '4px'; closeBtn.style.boxShadow = '0 0 0 #000'; };
        closeBtn.onmouseup = () => { closeBtn.style.top = '0'; closeBtn.style.boxShadow = '0 4px 0 #000'; };
        closeBtn.onclick = togglePanel;
    }

    function togglePanel() {
        const panel = document.getElementById('titan-tiny-panel');
        uiVisible = !uiVisible;
        panel.style.display = uiVisible ? 'flex' : 'none';
    }

    function scanAndApplyRemoteScales() {
        if (!window.gameScene || individualScales.size === 0) return;

        window.gameScene.traverse(obj => {
            if (!obj.name) return;
            const name = obj.name.toLowerCase();
            
            // Basic heuristic to identify players or entities
            // We check if any stored name is part of the object name
            for (const [targetName, scale] of individualScales) {
                if (name.includes(targetName)) {
                    // Check if it's already scaled to avoid redundant updates
                    // Allow small tolerance
                    if (Math.abs(obj.scale.x - scale) > 0.01) {
                         obj.scale.set(scale, scale, scale);
                         // Force matrix update
                         if (obj.updateMatrix) obj.updateMatrix();
                    }
                }
            }
        });
    }

    function gameLoop() {
        requestAnimationFrame(gameLoop);

        // 1. Apply Local Player Scale (from UI)
        let p = null;
        let source = "None";

        try {
            if (window.Game && window.Game.player) { p = window.Game.player; source = "Game.player"; }
            else if (window.game && window.game.player) { p = window.game.player; source = "game.player"; }
            else if (window.gameInstance && window.gameInstance.player) { p = window.gameInstance.player; source = "gameInst.player"; }
            else if (window.player) { p = window.player; source = "window.player"; }
        } catch (err) {
            console.error("[TitanAndTiny] Error finding player:", err);
        }

        const debugEl = document.getElementById('titan-debug-info');
        
        if (p) {
            window.MOD_PLAYER_SCALE = playerScale;
            p.resizerScale = playerScale; 

            // Visual Scale for Local Player
            let target = null;
            if (typeof p.getClientModel === 'function') {
                try { target = p.getClientModel(); } catch (e) {}
            }
            if (!target && p.mesh) target = p.mesh;
            
            let found = 0;
            if (target && target.scale) {
                found = 1;
                if (target.scale.x !== playerScale || target.scale.y !== playerScale || target.scale.z !== playerScale) {
                    target.scale.set(playerScale, playerScale, playerScale);
                    if (target.updateMatrix) target.updateMatrix();
                }
            }

            // Hitbox/Properties Scale for Local Player
            const newW = CONFIG.baseWidth * playerScale;
            const newH = CONFIG.baseHeight * playerScale;
            const blockSize = 16;
            
            if (typeof p.setSize === 'function') {
                if (Math.abs(p.width - newW) > 0.01 || Math.abs(p.height - newH) > 0.01) {
                    p.setSize(newW, newH);
                }
            } else {
                p.width = newW;
                p.height = newH;
                
                if (p.dim) {
                     p.dim.height = newH * blockSize;
                     p.dim.torso = 0.5 * blockSize * playerScale;
                     p.dim.headSize = 0.5 * blockSize * playerScale;
                }
                if (p.halfHeight !== undefined) p.halfHeight = (newH * blockSize) / 2;
                if (p.halfWidth !== undefined) p.halfWidth = (newW * blockSize) / 2;
                if (p.halfDepth !== undefined) p.halfDepth = (newW * blockSize) / 2;
            }

            const eyeH = (CONFIG.baseHeight * playerScale) * CONFIG.eyeFactor;
            p.eyeHeight = eyeH;
            if (p.data) p.data.eyeHeight = eyeH;

            if (debugEl) {
                debugEl.innerText = `Src: ${source} | Obj: ${found} | Scale: ${playerScale.toFixed(2)}`;
            }
        } else {
            if (debugEl) debugEl.innerText = "Debug: Searching for player...";
        }

        // 2. Apply Remote Player Scales (from setPlayerSize)
        scanAndApplyRemoteScales();
    }

    const init = () => {
        if (window.titanAndTinyInitialized) return;
        window.titanAndTinyInitialized = true;
        console.log("[TitanAndTiny] Starting Initialization...");
        try {
            createUI();
            
            const observer = new MutationObserver(() => {
                injectSettingsButton();
            });
            observer.observe(document.body, { childList: true, subtree: true });

            requestAnimationFrame(gameLoop);
            console.log("[TitanAndTiny] Initialization Complete.");
        } catch (e) {
            console.error("[TitanAndTiny] Init Error:", e);
        }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
        window.addEventListener('load', init);
    }

})();
