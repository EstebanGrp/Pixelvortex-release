(function() {
    
    const debugDiv = document.createElement('div');
    debugDiv.style.cssText = "position:fixed;top:50px;left:10px;background:rgba(0,0,0,0.85);color:#00ff00;font-family:monospace;padding:8px;z-index:9999;pointer-events:none;font-size:11px;max-width:350px;border-left: 3px solid #00ff00;border-radius:4px;";
    debugDiv.innerHTML = "FreshMoves v3.1: Esperando motor...";
    document.body.appendChild(debugDiv);

    function log(msg) {
        
        const lines = debugDiv.innerHTML.split('<br>');
        if (lines.length > 8) lines.shift();
        lines.push(msg);
        debugDiv.innerHTML = lines.join('<br>');
    }

    
    const ANIM_CONFIG = {
        breathingSpeed: 0.003,
        breathingAmp: 0.03, 
        idleSwaySpeed: 0.002,
        idleSwayAmp: 0.02,
        walkBobSpeed: 0.01,
        walkBobAmp: 0.05
    };

    let players = new Map(); 
    let lastTime = 0;

    
    function updateFreshMoves() {
        requestAnimationFrame(updateFreshMoves);

        const now = Date.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        
        const scene = window.gameScene;
        if (!scene) {
            if (now % 1000 < 20) log("Esperando window.gameScene...");
            return;
        }

        
        if (now % 1000 < 20) {
            scanForPlayers(scene);
        }

        
        if (players.size > 0) {
            let activeCount = 0;
            players.forEach((data, playerObj) => {
                if (!playerObj.parent) {
                    players.delete(playerObj); 
                    return;
                }
                animatePlayer(playerObj, data, now);
                activeCount++;
            });
            
        } else {
            if (now % 2000 < 20) log("Escena activa. Buscando jugadores...");
        }
    }

    
    function scanForPlayers(scene) {
        scene.traverse(obj => {
            
            if (players.has(obj)) return;

            
            
            
            
            

            let isCandidate = false;
            let parts = {};

            
            const name = (obj.name || "").toLowerCase();
            if (name === "player" || name.includes("entity_player") || (obj.userData && obj.userData.type === "player")) {
                isCandidate = true;
            }

            
            if (!isCandidate && obj.children && obj.children.length >= 4) { 
                
                
                
                
                const sortedY = [...obj.children].sort((a, b) => b.position.y - a.position.y);
                
                
                
                
                
                
                
                if (sortedY.length >= 2) {
                    
                    const head = sortedY[0];
                    const body = sortedY[1];
                    
                    if (head.position.y > body.position.y) {
                         
                         isCandidate = true;
                         parts.head = head;
                         parts.body = body;
                         
                         
                         const arms = sortedY.filter(c => c !== head && c !== body && Math.abs(c.position.y - body.position.y) < 0.5);
                         if (arms.length > 0) parts.arms = arms;
                         
                         
                         const legs = sortedY.filter(c => c !== head && c !== body && !arms.includes(c) && c.position.y < body.position.y);
                         if (legs.length > 0) parts.legs = legs;
                    }
                }
            }

            if (isCandidate) {
                log("Entidad detectada: " + (obj.name || "SinNombre") + " (Hijos: " + obj.children.length + ")");
                players.set(obj, {
                    parts: parts,
                    baseY: obj.position.y,
                    lastPos: obj.position.clone(),
                    isMoving: false
                });
            }
        });
    }

    function animatePlayer(player, data, time) {
        
        const dist = player.position.distanceTo(data.lastPos);
        data.isMoving = dist > 0.01;
        data.lastPos.copy(player.position);

        
        const breathe = Math.sin(time * ANIM_CONFIG.breathingSpeed);
        const sway = Math.sin(time * ANIM_CONFIG.idleSwaySpeed);

        
        if (data.parts.body) {
            
            const s = 1 + breathe * ANIM_CONFIG.breathingAmp;
            data.parts.body.scale.set(s, 1 + breathe * (ANIM_CONFIG.breathingAmp * 0.5), s);
        } else {
            
            
            
        }

        
        if (data.parts.head) {
            data.parts.head.rotation.y = sway * 0.05;
            data.parts.head.rotation.z = Math.cos(time * 0.001) * 0.02;
        }

        
        if (data.isMoving) {
            const walkCycle = time * 10; 
            
            
            player.position.y = data.baseY + Math.abs(Math.sin(walkCycle)) * ANIM_CONFIG.walkBobAmp;
            
            
            if (data.parts.arms) {
                data.parts.arms.forEach((arm, i) => {
                    
                    const dir = i % 2 === 0 ? 1 : -1;
                    arm.rotation.x = Math.sin(walkCycle) * dir;
                });
            }
            
            
            if (data.parts.legs) {
                data.parts.legs.forEach((leg, i) => {
                    const dir = i % 2 === 0 ? -1 : 1; 
                    leg.rotation.x = Math.sin(walkCycle) * dir;
                });
            }
        } else {
            
            if (data.parts.arms) {
                data.parts.arms.forEach(arm => arm.rotation.x *= 0.9);
            }
            if (data.parts.legs) {
                data.parts.legs.forEach(leg => leg.rotation.x *= 0.9);
            }
            
            player.position.y += (data.baseY - player.position.y) * 0.1;
        }
    }

    
    setTimeout(updateFreshMoves, 1000);

})();