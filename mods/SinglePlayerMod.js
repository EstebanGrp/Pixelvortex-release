
(function() {
    console.log("[SinglePlayerMod] Loaded - Waiting for game initialization...");

    try {
        if (window.PV_LAUNCH_MODE === "multiplayer") return;
    } catch (_) {}

    
    function findSocket() {
        
        if (window.g && window.g.socket) return window.g.socket;
        if (window.ClientSocket && window.ClientSocket.socket) return window.ClientSocket.socket;
        
        
        for (let key in window) {
            try {
                let obj = window[key];
                if (!obj) continue;

                
                if (obj.io && typeof obj.emit === 'function') {
                     console.log("[SinglePlayerMod] Found socket at window." + key);
                     return obj;
                }
                
                if (obj.socket && typeof obj.socket.emit === 'function') {
                    console.log("[SinglePlayerMod] Found socket at window." + key + ".socket");
                    return obj.socket;
                }
            } catch(e) {}
        }
        return null;
    }

    
    function findGame() {
        if (window.g) return window.g;
        
        for (let key in window) {
            try {
                let obj = window[key];
                if (obj && typeof obj.connect === 'function' && typeof obj.join === 'function') {
                    return obj;
                }
            } catch(e) {}
        }
        return null;
    }

    
    function injectUI() {
        
        const allDivs = document.querySelectorAll('div, span, button, a');
        let playBtn = null;
        
        for (let el of allDivs) {
            if (el.textContent.includes('PLAY') && el.textContent.length < 20) {
                
                playBtn = el;
                
                if (el.textContent.includes('>>') && el.textContent.includes('<<')) {
                    break;
                }
            }
        }

        if (playBtn && !playBtn.dataset.injected) {
            console.log("[SinglePlayerMod] Found PLAY button:", playBtn);
            playBtn.dataset.injected = "true";
            
            
            playBtn.style.border = "2px solid #00ff00";
            playBtn.title = "Singleplayer Injected";

            
            playBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log("[SinglePlayerMod] PLAY clicked - showing UI");
                showSelectionUI();
                return false;
            }, true);
            
            
            const clone = playBtn.cloneNode(true);
            playBtn.parentNode.replaceChild(clone, playBtn);
            clone.addEventListener('click', (e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 showSelectionUI();
            });
            
            
            playBtn = clone;
        }
    }

    
    function showSelectionUI() {
        
        const existing = document.getElementById('sp-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'sp-modal';
        modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;justify-content:center;align-items:center;font-family:'Faithful', sans-serif, monospace;";
        
        modal.innerHTML = `
            <div style="background:#1a1a1a; padding:30px; border-radius:15px; border: 2px solid #444; color:white; text-align:center; width: 300px; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                <h2 style="margin-top:0; color: #3d6df2; text-shadow: 2px 2px 0 #000;">SINGLE PLAYER</h2>
                
                <div style="margin: 15px 0; text-align: left;">
                    <label style="display:block; margin-bottom:5px; color:#aaa; font-size:14px;">Nickname</label>
                    <input id="sp-name" value="EstebanGrp_" style="width:100%; padding:8px; background:#333; border:1px solid #555; color:white; border-radius:4px; box-sizing:border-box;">
                </div>

                <div style="margin: 15px 0; text-align: left;">
                    <label style="display:block; margin-bottom:5px; color:#aaa; font-size:14px;">Skin</label>
                    <select id="sp-skin" style="width:100%; padding:8px; background:#333; border:1px solid #555; color:white; border-radius:4px; box-sizing:border-box;">
                        <option value="steve">Steve</option>
                        <option value="alex">Alex</option>
                        <option value="zombie">Zombie</option>
                        <option value="skeleton">Skeleton</option>
                    </select>
                </div>

                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button id="sp-close" style="flex:1; padding:10px; background:#c62828; border:none; color:white; border-radius:6px; cursor:pointer; font-weight:bold;">CANCEL</button>
                    <button id="sp-start" style="flex:2; padding:10px; background:#2e7d32; border:none; color:white; border-radius:6px; cursor:pointer; font-weight:bold;">PLAY LOCAL</button>
                </div>
                
                <div id="sp-status" style="margin-top:10px; font-size:12px; color:#888;">Ready</div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('sp-close').onclick = () => modal.remove();
        
        document.getElementById('sp-start').onclick = () => {
            const name = document.getElementById('sp-name').value || "EstebanGrp_";
            const skin = document.getElementById('sp-skin').value;
            const status = document.getElementById('sp-status');

            status.textContent = "Starting local...";
            status.style.color = "#ffff00";

            try {
                localStorage.setItem("PV_SP_NAME", name);
                localStorage.setItem("PV_SP_SKIN", skin);
                localStorage.setItem("PV_OFFLINE", "1");
            } catch (_) {}

            try {
                window.onbeforeunload = null;
                window.location.replace("/?connect=local&offline=1");
                modal.remove();
                return;
            } catch (_) {}

            const game = window.Game || findGame();
            if (game && typeof game.connect === "function") {
                console.log("[SinglePlayerMod] Starting local game:", { name, skin });
                game.connect("local", !1, !0);
                modal.remove();
                return;
            }

            status.textContent = "Error: Game not found!";
            status.style.color = "#ff4444";
            console.error("[SinglePlayerMod] Game not found");
        };
    }

    
    const observer = new MutationObserver(() => injectUI());
    (function startObserver() {
        const target = document.body || document.documentElement;
        if (!target) {
            setTimeout(startObserver, 50);
            return;
        }
        observer.observe(target, { childList: true, subtree: true });
    })();
    
    
    setInterval(injectUI, 2000);
    
    
    setTimeout(injectUI, 1000);

})();
