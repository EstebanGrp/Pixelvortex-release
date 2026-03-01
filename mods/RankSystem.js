(function() {
    const CONFIG_URL = "https://raw.githubusercontent.com/EstebanGrp/pixelvortex-3.2.x/refs/heads/main/pixelvortexcontrol.json";
    
    const RankSystem = {
        config: null,
        currentUser: null,
        ranksById: null,

        async init() {
            console.log("%c[RankSystem] Iniciando v1.1...", "color: #9b59ff; font-weight: bold;");
            await this.fetchConfig();
            
            
            if (!this.config) {
                console.warn("[RankSystem] Usando configuración de emergencia (fallback)");
                this.config = {
                    ranks: {
                        owner: { id: "owner", prefix: "[OWNER]", style: { color: "gold", bold: true, glow: true }, permLevel: 5 },
                        admin: { id: "admin", prefix: "[ADMIN]", style: { color: "red", bold: true, glow: true }, permLevel: 4 },
                        goat: { id: "goat", prefix: "[GOAT]", style: { color: "#FFA500", bold: true, glow: true }, permLevel: 4 },
                        janitor: { id: "janitor", prefix: "[JANITOR]", style: { color: "#84C3BE", bold: true, glow: true }, permLevel: 4 },
                        mod: { id: "mod", prefix: "[MOD]", style: { color: "yellow", bold: true, glow: true }, permLevel: 3 },
                        youtube: { id: "youtube", prefix: "[YOUTUBE]", style: { color: "pink", bold: true, glow: true }, permLevel: 1 },
                        helper: { id: "helper", prefix: "[HELPER]", style: { color: "aqua", bold: true, glow: false }, permLevel: 1 },
                        builder: { id: "builder", prefix: "[BUILDER]", style: { color: "royalblue", bold: true, glow: false }, permLevel: 0 },
                        og: { id: "og", prefix: "[OG]", style: { color: "aqua", bold: true, glow: false }, permLevel: 0 },
                        immortal: { id: "immortal", prefix: "[IMMORTAL]", style: { color: "orange", bold: true, glow: true }, permLevel: 0 },
                        legend: { id: "legend", prefix: "[LEGEND]", style: { color: "lime", bold: true, glow: true }, permLevel: 0 },
                        pro: { id: "pro", prefix: "[PRO]", style: { color: "magenta", bold: true, glow: false }, permLevel: 0 },
                        pixelvortex: { id: "pixelvortex", prefix: "[PixelVortex]", style: { color: "#2227bd", bold: true, glow: true }, permLevel: 5 },
                        user: { id: "user", prefix: "[USER]", style: { color: "#ffffff", bold: false, glow: false }, permLevel: 0 }
                    },
                    users: [
                        { username: "EstebanGrp_", rank: "owner" },
                        { username: "Wolf_Shadow_Wolf", rank: "admin" },
                        { username: "Wolf_Esteban_GRPWolf", rank: "pixelvortex" }
                    ],
                    global: { maintenance: false }
                };
            }

            await this.waitForBody();
            this.checkMaintenance();
            this.buildUserRankMap();
            this.buildRankIndex();
            this.injectStyles();
            this.setupObserver();
            
            console.log("[RankSystem] Sistema listo. Usuarios monitoreados:", this.config.users.length);
        },

        async fetchConfig() {
            try {
                const response = await fetch(CONFIG_URL + "?t=" + Date.now());
                if (!response.ok) throw new Error("HTTP " + response.status);
                this.config = await response.json();
                console.log("[RankSystem] Configuración cargada desde GitHub");
            } catch (e) {
                console.error("[RankSystem] Error cargando configuración remota:", e.message);
            }
        },

        waitForBody() {
            if (document.body) return Promise.resolve();
            return new Promise(function(resolve) {
                function check() {
                    if (document.body) {
                        document.removeEventListener("DOMContentLoaded", check);
                        resolve();
                    }
                }
                document.addEventListener("DOMContentLoaded", check);
                check();
            });
        },

        checkMaintenance() {
            if (document.body && this.config && this.config.global && this.config.global.maintenance) {
                document.body.innerHTML = '<div style="background:#1a1a1a;color:white;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;text-align:center;"><h1 style="color:#ff3b3b;">Mantenimiento</h1><p style="font-size:1.2em;">' + this.config.global.maintenance_message + '</p><div style="margin-top:20px;color:#888;">Pixel Vortex ' + this.config.meta.version + '</div></div>';
            }
        },

        injectStyles() {
            var style = document.createElement('style');
            var css = '.pv-rank { margin-right: 0.3em; font-weight: 900 !important; font-size: 1em !important; font-family: inherit !important; vertical-align: middle; line-height: inherit; text-transform: uppercase; display: inline-block !important; }.pv-glow { text-shadow: 0 0 0.4em currentColor !important; }.pv-bold { font-weight: 900 !important; }' +
                      '.player-list-item, .player-row, .player-name-container { display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: flex-start !important; flex-wrap: nowrap !important; }';

            if (this.config && this.config.ranks) {
                for (var rankId in this.config.ranks) {
                    var rank = this.config.ranks[rankId];
                    if (!rank || !rank.style || !rank.style.color) continue;
                    var classId = rank.id ? String(rank.id) : String(rankId);
                    css += '.pv-rank-' + classId + ' { color: ' + rank.style.color + ' !important; }';
                }
            }

            style.textContent = css;
            document.head.appendChild(style);
        },

        normalizeKey(value) {
            return value == null ? "" : String(value).trim().toLowerCase();
        },

        buildUserRankMap() {
            this.userRankMap = {};
            if (!this.config || !this.config.users) return;
            for (var i = 0; i < this.config.users.length; i++) {
                var u = this.config.users[i];
                if (!u || !u.username || !u.rank) continue;
                this.userRankMap[String(u.username).toLowerCase()] = String(u.rank);
            }
        },

        buildRankIndex() {
            this.ranksById = {};
            if (!this.config || !this.config.ranks) return;
            for (var rankKey in this.config.ranks) {
                var rank = this.config.ranks[rankKey];
                if (!rank) continue;
                var keyNorm = this.normalizeKey(rankKey);
                if (keyNorm) this.ranksById[keyNorm] = rank;
                var idNorm = this.normalizeKey(rank.id);
                if (idNorm) this.ranksById[idNorm] = rank;
            }
        },

        getRankIdForUsername(username) {
            if (!username) return null;
            if (!this.userRankMap) this.buildUserRankMap();
            var key = String(username).toLowerCase();
            return this.userRankMap ? this.userRankMap[key] || null : null;
        },

        getRankData(rankId) {
            var fallback = { id: "user", prefix: "", style: { color: "#ffffff", bold: false, glow: false } };
            if (!this.config || !this.config.ranks) return fallback;

            if (rankId && this.config.ranks[rankId]) return this.config.ranks[rankId];

            var rankNorm = this.normalizeKey(rankId);
            if (rankNorm) {
                if (this.config.ranks[rankNorm]) return this.config.ranks[rankNorm];
                if (!this.ranksById) this.buildRankIndex();
                if (this.ranksById && this.ranksById[rankNorm]) return this.ranksById[rankNorm];
            }

            return this.config.ranks.user || fallback;
        },

        setupObserver() {
            var self = this;
            var observer = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var addedNodes = mutations[i].addedNodes;
                    for (var j = 0; j < addedNodes.length; j++) {
                        var node = addedNodes[j];
                        if (node.nodeType === 1) { 
                            self.processNode(node);
                            var children = node.getElementsByTagName('*');
                            for (var k = 0; k < children.length; k++) {
                                self.processNode(children[k]);
                            }
                        }
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            
            
            setTimeout(function() {
                var all = document.getElementsByTagName('*');
                for (var i = 0; i < all.length; i++) {
                    self.processNode(all[i]);
                }
            }, 2000);
        },

        processNode(node) {
            if (!node || !node.textContent || node.dataset.rankProcessed) return;
            if (!this.config || !this.config.users) return;

            var text = node.textContent;
            var users = this.config.users;

            for (var i = 0; i < users.length; i++) {
                var user = users[i];
                
                var escapedName = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                var nameRegex = new RegExp("(^|\\s|\\(|\\d)" + escapedName + "(\\s|:|\\)|$)", "i");

                if (nameRegex.test(text)) {
                    
                    
                    if (node.children.length > 0 && node.tagName !== 'SPAN') {
                        continue; 
                    }
                    this.applyRankToNode(node, user);
                    break;
                }
            }
        },

        applyRankToNode(node, userData) {
            const rank = this.getRankData(userData.rank);
            if (!rank || !rank.prefix) {
                node.dataset.rankProcessed = "true";
                return;
            }

            
            node.dataset.rankProcessed = "true";

            const prefixSpan = document.createElement('span');
            prefixSpan.className = `pv-rank pv-rank-${rank.id}${rank.style.glow ? ' pv-glow' : ''}${rank.style.bold ? ' pv-bold' : ''}`;
            prefixSpan.textContent = rank.prefix + " ";

            
            if (node.firstChild) {
                node.insertBefore(prefixSpan, node.firstChild);
            } else {
                node.appendChild(prefixSpan);
            }

            
            if (rank.style.color) {
                node.style.color = rank.style.color;
            }
        },

        setupNametagLoop() {
            setInterval(() => {
                this.updateNametags();
            }, 1000);
        },

        updateNametags() {
            if (!window.game || !window.game.world) return;
            
            var players = [];
            
            if (typeof window.game.world.playersIterator === 'function') {
                for (let p of window.game.world.playersIterator()) {
                    players.push(p);
                }
            } else if (window.game.world.players) {
                if (Array.isArray(window.game.world.players)) {
                    players = window.game.world.players;
                } else if (window.game.world.players instanceof Map) {
                    players = Array.from(window.game.world.players.values());
                } else if (typeof window.game.world.players === 'object') {
                    players = Object.values(window.game.world.players);
                }
            }

            for (var i = 0; i < players.length; i++) {
                this.applyRankToPlayer(players[i]);
            }
        },

        applyRankToPlayer(player) {
            if (!player || !player.profile || !player.profile.username) return;
            
            
            var originalName = player.profile._originalName || player.profile.username;
            
            
            if (player.profile._rankProcessed && player.profile.username.indexOf(originalName) !== -1) return;

            var rankId = this.getRankIdForUsername(originalName);
            if (!rankId) return;

            var rank = this.getRankData(rankId);
            if (!rank || !rank.prefix) return;

            
            if (!player.profile._originalName) {
                player.profile._originalName = originalName;
            }

            
            var colorCode = this.getMinecraftColor(rank.style.color);
            
            
            var newName = rank.prefix + " " + originalName;
            if (colorCode) {
                newName = colorCode + rank.prefix + "§r " + originalName;
            }

            player.profile.username = newName;
            player.profile._rankProcessed = true;

            
            if (typeof player.setCustomNameTag === 'function') {
                player.setCustomNameTag(newName);
            }
        },

        getMinecraftColor(hex) {
            if (!hex) return "";
            hex = hex.toLowerCase();
            
            const map = {
                "#2227bd": "§9", 
                "#ff3b3b": "§c", 
                "#ffffff": "§f", 
                "#000000": "§0", 
                "#ffff55": "§e", 
                "#00aa00": "§2", 
                "#55ff55": "§a", 
                "#00aaaa": "§3", 
                "#55ffff": "§b", 
                "#aa0000": "§4", 
                "#aa00aa": "§5", 
                "#ff55ff": "§d", 
                "#ffaa00": "§6", 
                "#aaaaaa": "§7", 
                "#555555": "§8"  
            };
            return map[hex] || "";
        }
    };

    window.RankSystem = RankSystem;
    RankSystem.init();
})();
