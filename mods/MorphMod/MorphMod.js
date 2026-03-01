(function() {
    console.log("[MorphMod] Loading v3.1 (Fixed Mobs)...");

    // Helper to capture game classes
    let RealModel = null;
    let RealModelBiped = null;
    let RealObject3D = null;
    let classesInitialized = false;

    
    function getLocalPlayer() {
        if (window.Game && window.Game.player) return window.Game.player;
        if (window.game && window.game.player) return window.game.player;
        if (window.gameInstance && window.gameInstance.player) return window.gameInstance.player;
        if (window.player) return window.player;
        return null;
    }

    function getPlayerMesh(player) {
        if (!player) return null;
        if (typeof player.getClientModel === 'function') {
            try { return player.getClientModel(); } catch (e) {}
        }
        if (player.mesh) return player.mesh;
        if (player._render) return player._render;
        return null;
    }

    
    const MOBS = [
        { name: "Player",    modelClass: null, type: "Player" }, 
        { name: "Pig",      modelClass: "ModelPig",     type: "animal" },
        { name: "Cow",      modelClass: "ModelCow",     type: "animal" },
        { name: "Sheep",    modelClass: "ModelSheep",   type: "animal" },
        { name: "Chicken",  modelClass: "ModelChicken", type: "animal" },
        { name: "Zombie",   modelClass: "ModelZombie",  type: "monster" },
        { name: "Skeleton", modelClass: "ModelSkeleton", type: "monster" },
        { name: "Creeper",  modelClass: "ModelCreeper", type: "monster" },
        { name: "Spider",   modelClass: "ModelSpider",  type: "monster" },
        { name: "Ghost",    modelClass: "ModelGhost",   type: "monster" },
    ];

    let currentMorph = null; 
    let uiVisible = false;
    let originalGetModel = null;

    
    function initializeClasses(playerModel) {
        if (classesInitialized) return;

        try {
            
            const ModelPlayer = playerModel.constructor;
            RealModelBiped = Object.getPrototypeOf(ModelPlayer);
            RealModel = Object.getPrototypeOf(RealModelBiped);
            
            
            const RealGroup = Object.getPrototypeOf(RealModel);
            RealObject3D = Object.getPrototypeOf(RealGroup);

            console.log("[MorphMod] Captured Base Classes:", { 
                Model: RealModel.name, 
                ModelBiped: RealModelBiped.name, 
                Object3D: RealObject3D.name 
            });

            
            window.ModelQuadruped = class extends RealModel {
                constructor(h, p, g = 6) {
                    super();
                    this.legOffsetX = 2.5 / 16;
                    this.legOffsetY = 3 / 16;
                    this.legOffsetZFront = -5 / 16;
                    this.legOffsetZBack = 7 / 16;
                    this.skinName = p;
                    
                    
                    const addBox = RealModel.addBox; 
                    
                    this.parts.head = addBox(0, 0, 8, 8, 8);
                    this.parts.torso = addBox(28, 8, 10, 16, 8);
                    this.parts.leftArm = addBox(0, 16, 4, g, 4);
                    this.parts.rightArm = addBox(0, 16, 4, g, 4);
                    this.parts.leftLeg = addBox(0, 16, 4, g, 4);
                    this.parts.rightLeg = addBox(0, 16, 4, g, 4);
                    
                    this.addAdjustments(h);
                    this.addBodyParts(h);
                    this.assembleBody(h);
                    if (h.skeleton) h.skeleton.scale.set(0.95, 0.95, 0.95);
                }

                addHead(h) {
                    h.meshes.head = this.initMesh("head");
                    h.meshes.head.position.set(0, 0.75, -0.75);
                    h.neck = new RealObject3D();
                    h.neck.add(h.meshes.head);
                    h.neck.position.set(0, -0.075, 0);
                }

                addTorso(h) {
                    h.meshes.torso = this.initMesh("torso");
                    h.torso = h.meshes.torso;
                    h.torso.rotation.x = -Math.PI / 2;
                    h.torso.position.y = 0.5;
                }

                addLegs(h) {
                    h.meshes.leftArm = this.initMesh("leftArm");
                    h.meshes.leftArm.position.y = -this.legOffsetY;
                    h.meshes.leftArm.position.x = -this.legOffsetX;
                    
                    h.meshes.rightArm = this.initMesh("rightArm");
                    h.meshes.rightArm.position.y = -this.legOffsetY;
                    h.meshes.rightArm.position.x = this.legOffsetX;
                    
                    h.leftShoulder = new RealObject3D();
                    h.leftShoulder.add(h.meshes.leftArm);
                    h.leftShoulder.position.set(0, this.legOffsetY * 2, this.legOffsetZFront);
                    
                    h.rightShoulder = new RealObject3D();
                    h.rightShoulder.add(h.meshes.rightArm);
                    h.rightShoulder.position.set(0, this.legOffsetY * 2, this.legOffsetZFront);
                    
                    h.meshes.leftLeg = this.initMesh("leftLeg");
                    h.meshes.leftLeg.position.y = -this.legOffsetY;
                    h.meshes.leftLeg.position.x = -this.legOffsetX;
                    
                    h.meshes.rightLeg = this.initMesh("rightLeg");
                    h.meshes.rightLeg.position.y = -this.legOffsetY;
                    h.meshes.rightLeg.position.x = this.legOffsetX;
                    
                    h.leftHip = new RealObject3D();
                    h.leftHip.add(h.meshes.leftLeg);
                    h.leftHip.position.set(0, this.legOffsetY * 2, this.legOffsetZBack);
                    
                    h.rightHip = new RealObject3D();
                    h.rightHip.add(h.meshes.rightLeg);
                    h.rightHip.position.set(0, this.legOffsetY * 2, this.legOffsetZBack);
                }

                assembleBody(h) {
                    if (h.body) h.body.clear(); 
                    else h.body = new RealObject3D(); 

                    h.body.add(h.torso);
                    h.body.add(h.leftShoulder);
                    h.body.add(h.rightShoulder);
                    h.body.add(h.leftHip);
                    h.body.add(h.rightHip);
                    
                    if (h.skeleton) {
                        h.skeleton.add(h.body);
                        h.skeleton.add(h.neck);
                        h.add(h.skeleton);
                    } else {
                        
                        h.add(h.body);
                        h.add(h.neck);
                    }
                }

                addBodyParts(h) {
                    this.addHead(h);
                    this.addTorso(h);
                    this.addLegs(h);
                }
                
                addAdjustments(h) {}
                
                
                addHat() {}
                attachGlobalHatToLiving() {}
            };

            
            window.ModelCow = class extends window.ModelQuadruped {
                constructor(u) {
                    super(u, "cow", 12);
                    if(u.torso) u.torso.position.y = 1;
                    if(u.meshes && u.meshes.head) u.meshes.head.position.y = 1.25;
                }
                addAdjustments(u) {
                    this.legOffsetX = 3.5 / 16;
                    this.legOffsetY = 6 / 16;
                    this.parts.head = RealModel.addBox(0, 0, 8, 8, 6);
                    this.parts.torso = RealModel.addBox(18, 4, 12, 18, 10);
                    
                    
                    
                    
                    
                    
                }
            };

            window.ModelPig = class extends window.ModelQuadruped {
                constructor(u) {
                    super(u, "pig");
                }
                addHead(u) {
                    this.parts.nose = RealModel.addBox(16, 16, 4, 3, 1);
                    super.addHead(u);
                    u.meshes.nose = this.initMesh("nose");
                    u.meshes.nose.position.set(0, -0.125, -0.25);
                    u.meshes.head.add(u.meshes.nose);
                }
            };
            
            window.ModelSheep = class extends window.ModelQuadruped {
                 constructor(u) {
                    super(u, "sheep", 6); 
                 }
                 
            };

            
            
            
            window.ModelZombie = class extends RealModelBiped {
                constructor(h) {
                    super(h); 
                    this.skinName = "zombie";
                    
                }
                addHat() {} 
            };
            
            window.ModelSkeleton = class extends RealModelBiped {
                constructor(h) {
                    super(h);
                    this.skinName = "skeleton";
                }
                addHat() {}
            };

            window.ModelChicken = class extends RealModel {
                constructor(h) {
                    super();
                    
                    
                    this.legOffsetX = 1.5 / 16;  
                    this.legOffsetY = 3 / 16;    
                    this.armOffsetX = 3.5 / 16;  
                    this.armOffsetY = 8 / 16;    
                    this.skinName = "chicken";
                    
                    const addBox = RealModel.addBox;

                    
                    
                    
                    
                    
                    this.parts.head = addBox(0, 0, 4, 6, 3);
                    
                    
                    this.parts.bill = addBox(14, 0, 4, 2, 2);
                    
                    
                    this.parts.chin = addBox(14, 4, 2, 2, 2);
                    
                    
                    this.parts.torso = addBox(0, 9, 6, 8, 6);
                    
                    
                    this.parts.leftLeg = addBox(26, 0, 3, 5, 3);
                    this.parts.rightLeg = addBox(26, 0, 3, 5, 3);
                    
                    
                    this.parts.leftWing = addBox(24, 13, 1, 4, 6);
                    this.parts.rightWing = addBox(24, 13, 1, 4, 6);
                    
                    this.addBodyParts(h);
                    this.assembleBody(h);
                }

                addHead(h) {
                    h.meshes.head = this.initMesh("head");
                    h.meshes.bill = this.initMesh("bill");
                    h.meshes.chin = this.initMesh("chin");
                    
                    
                    
                    
                    h.meshes.head.rotation.set(0, 0, 0); 
                    h.meshes.bill.rotation.set(0, 0, 0);
                    h.meshes.chin.rotation.set(0, 0, 0);

                    
                    
                    h.meshes.bill.position.set(0, 0, -0.15);       
                    h.meshes.chin.position.set(0, -0.125, -0.1);   
                    
                    if (!h.headPivot) h.headPivot = new RealObject3D();
                    else h.headPivot.clear();
                    
                    h.headPivot.add(h.meshes.head);
                    h.headPivot.add(h.meshes.bill);
                    h.headPivot.add(h.meshes.chin);
                    
                    
                    
                    h.headPivot.position.set(0, 0.5, -0.25);
                    
                    h.neck = new RealObject3D();
                    h.neck.add(h.headPivot);
                }

                addTorso(h) {
                    h.meshes.torso = this.initMesh("torso");
                    
                    
                    
                    h.meshes.torso.rotation.set(-Math.PI / 2, 0, 0);

                    
                    
                    
                    h.meshes.torso.position.y = 0.35; 
                    h.torso = h.meshes.torso;
                }

                addWings(h) {
                    h.meshes.leftWing = this.initMesh("leftWing");
                    h.meshes.rightWing = this.initMesh("rightWing");
                    
                    
                    
                    
                    h.meshes.leftWing.rotation.set(0, 0, 0);
                    h.meshes.rightWing.rotation.set(0, 0, 0);

                    const p = 4 / 16;
                    h.meshes.leftWing.position.y = -p;
                    h.meshes.rightWing.position.y = -p;
                    h.meshes.leftWing.position.x = -this.armOffsetX;
                    h.meshes.rightWing.position.x = this.armOffsetX;
                    
                    h.leftShoulder = new RealObject3D();
                    h.leftShoulder.add(h.meshes.leftWing);
                    h.leftShoulder.position.set(0, this.armOffsetY + p, 0);
                    
                    h.rightShoulder = new RealObject3D();
                    h.rightShoulder.add(h.meshes.rightWing);
                    h.rightShoulder.position.set(0, this.armOffsetY + p, 0);
                }

                addLegs(h) {
                    h.meshes.leftLeg = this.initMesh("leftLeg", true);
                    h.meshes.rightLeg = this.initMesh("rightLeg", true);
                    
                    
                    
                    h.meshes.leftLeg.rotation.set(0, 0, 0);
                    h.meshes.rightLeg.rotation.set(0, 0, 0);
                    
                    h.meshes.leftLeg.position.y = -this.legOffsetY;
                    h.meshes.rightLeg.position.y = -this.legOffsetY;
                    h.meshes.leftLeg.position.x = -this.legOffsetX;
                    h.meshes.rightLeg.position.x = this.legOffsetX;
                    
                    h.leftHip = new RealObject3D();
                    h.leftHip.add(h.meshes.leftLeg);
                    h.leftHip.position.set(0, this.legOffsetY * 2, 0);
                    
                    h.rightHip = new RealObject3D();
                    h.rightHip.add(h.meshes.rightLeg);
                    h.rightHip.position.set(0, this.legOffsetY * 2, 0);
                }

                addBodyParts(h) {
                    
                    this.addHead(h);
                    this.addTorso(h);
                    this.addLegs(h);
                    this.addWings(h);
                }

                assembleBody(h) {
                    
                    
                    if (h.body) h.body.clear();
                    
                    
                    h.body.add(h.torso);
                    h.body.add(h.leftShoulder);
                    h.body.add(h.rightShoulder);
                    h.body.add(h.leftHip);
                    h.body.add(h.rightHip);
                    
                    
                    h.skeleton.add(h.body);
                    h.skeleton.add(h.neck); 
                    
                    h.add(h.skeleton);
                }


                
                addHat() {}
            };
            
            
            window.ModelCreeper = class extends RealModel {
                constructor(h) {
                    super();
                    this.skinName = "creeper";
                    const addBox = RealModel.addBox;
                    this.parts.head = addBox(0, 0, 8, 8, 8);
                    this.parts.body = addBox(16, 16, 8, 12, 4);
                    this.parts.leg1 = addBox(0, 16, 4, 6, 4);
                    this.parts.leg2 = addBox(0, 16, 4, 6, 4);
                    this.parts.leg3 = addBox(0, 16, 4, 6, 4);
                    this.parts.leg4 = addBox(0, 16, 4, 6, 4);
                    
                    this.addBodyParts(h);
                    this.assembleBody(h);
                }

                addBodyParts(h) {
                    h.meshes.head = this.initMesh("head");
                    h.meshes.body = this.initMesh("body");
                    h.meshes.leg1 = this.initMesh("leg1");
                    h.meshes.leg2 = this.initMesh("leg2");
                    h.meshes.leg3 = this.initMesh("leg3");
                    h.meshes.leg4 = this.initMesh("leg4");
                    
                    h.meshes.head.position.set(0, 0.375, 0); 
                    h.meshes.body.position.set(0, -0.375, 0); 
                    
                    const legY = -0.75; 
                    const legOff = 0.125; 
                    const legZ = 0.25; 
                    
                    h.meshes.leg1.position.set(-legOff, legY, legZ);
                    h.meshes.leg2.position.set(legOff, legY, legZ);
                    h.meshes.leg3.position.set(-legOff, legY, -legZ);
                    h.meshes.leg4.position.set(legOff, legY, -legZ);
                }
                
                assembleBody(h) {
                     if (h.body) h.body.clear();
                     else h.body = new RealObject3D();
                     
                     h.body.add(h.meshes.body);
                     h.body.add(h.meshes.leg1);
                     h.body.add(h.meshes.leg2);
                     h.body.add(h.meshes.leg3);
                     h.body.add(h.meshes.leg4);
                     
                     if (h.headPivot) h.headPivot.clear();
                     else h.headPivot = new RealObject3D();
                     h.headPivot.add(h.meshes.head);
                     
                     h.add(h.body);
                     h.add(h.headPivot);
                }
                addHat() {}
            };

            window.ModelSpider = class extends RealModel {
                constructor(h) {
                    super();
                    this.skinName = "spider";
                    const addBox = RealModel.addBox;
                    this.parts.head = addBox(32, 4, 8, 8, 8);
                    this.parts.body = addBox(0, 12, 10, 8, 12); 
                    this.parts.neck = addBox(0, 0, 6, 6, 6); 
                    
                    for(let i=1; i<=8; i++) {
                        this.parts['leg'+i] = addBox(18, 0, 16, 2, 2);
                    }
                    
                    this.addBodyParts(h);
                    this.assembleBody(h);
                }
                
                addBodyParts(h) {
                    h.meshes.head = this.initMesh("head");
                    h.meshes.body = this.initMesh("body"); 
                    h.meshes.neck = this.initMesh("neck"); 
                    
                    for(let i=1; i<=8; i++) {
                        h.meshes['leg'+i] = this.initMesh('leg'+i);
                    }
                    
                    h.meshes.head.position.set(0, 0, -0.5); 
                    h.meshes.neck.position.set(0, 0, 0); 
                    h.meshes.body.position.set(0, 0, 0.75); 
                    
                    const legY = -0.25;
                    const spread = 0.5;
                    
                    h.meshes.leg1.position.set(-spread, legY, -0.4);
                    h.meshes.leg2.position.set(-spread, legY, -0.1);
                    h.meshes.leg3.position.set(-spread, legY, 0.2);
                    h.meshes.leg4.position.set(-spread, legY, 0.5);
                    
                    h.meshes.leg5.position.set(spread, legY, -0.4);
                    h.meshes.leg6.position.set(spread, legY, -0.1);
                    h.meshes.leg7.position.set(spread, legY, 0.2);
                    h.meshes.leg8.position.set(spread, legY, 0.5);
                    
                    const rot = Math.PI/4;
                    h.meshes.leg1.rotation.z = rot;
                    h.meshes.leg2.rotation.z = rot;
                    h.meshes.leg3.rotation.z = rot;
                    h.meshes.leg4.rotation.z = rot;
                    
                    h.meshes.leg5.rotation.z = -rot;
                    h.meshes.leg6.rotation.z = -rot;
                    h.meshes.leg7.rotation.z = -rot;
                    h.meshes.leg8.rotation.z = -rot;
                }
                
                assembleBody(h) {
                    if (h.body) h.body.clear();
                    else h.body = new RealObject3D();
                    
                    h.body.add(h.meshes.head);
                    h.body.add(h.meshes.neck);
                    h.body.add(h.meshes.body);
                    
                    for(let i=1; i<=8; i++) {
                        h.body.add(h.meshes['leg'+i]);
                    }
                    
                    h.add(h.body);
                }
                addHat() {}
            };

            window.ModelGhost = class extends RealModel {
                constructor(h) {
                    super();
                    this.skinName = "ghast"; 
                    const addBox = RealModel.addBox;
                    this.parts.body = addBox(0, 0, 16, 16, 16);
                    for(let i=1; i<=9; i++) {
                        this.parts['tentacle'+i] = addBox(0, 0, 4, 9, 4);
                    }
                    this.addBodyParts(h);
                    this.assembleBody(h);
                }
                
                addBodyParts(h) {
                    h.meshes.body = this.initMesh("body");
                    h.meshes.body.position.set(0, 3.0, 0); // Higher float position
                    
                    for(let i=1; i<=9; i++) {
                        h.meshes['tentacle'+i] = this.initMesh('tentacle'+i);
                        const x = (i % 3 - 1) * 0.4;
                        const z = (Math.floor((i-1)/3) - 1) * 0.4;
                        h.meshes['tentacle'+i].position.set(x, 2.0, z); // Adjusted for body height
                    }
                }
                
                assembleBody(h) {
                    if (h.body) h.body.clear();
                    else h.body = new RealObject3D();
                    
                    h.body.add(h.meshes.body);
                    for(let i=1; i<=9; i++) {
                        h.body.add(h.meshes['tentacle'+i]);
                    }
                    
                    h.add(h.body);
                }
                addHat() {}
            };

            MOBS.forEach(mob => {
                if (typeof mob.modelClass === 'string' && window[mob.modelClass]) {
                    mob.modelClass = window[mob.modelClass];
                    console.log(`[MorphMod] Bound ${mob.name} to ${mob.modelClass.name}`);
                } else if (typeof mob.modelClass === 'string') {
                    console.warn(`[MorphMod] Could not find class for ${mob.name} (${mob.modelClass})`);
                }
            });

            classesInitialized = true;
            console.log("[MorphMod] Mob classes initialized. Total mobs:", MOBS.length);

        } catch (e) {
            console.error("[MorphMod] Error initializing classes:", e);
        }
    }

    
    function hookRenderPlayer() {
        if (!window.RenderPlayer || originalGetModel) return;
        
        originalGetModel = window.RenderPlayer.prototype.getModel;
        
        window.RenderPlayer.prototype.getModel = function(forceRebuild = false) {
            const localPlayer = getLocalPlayer();
            const isLocalPlayer = localPlayer && (this.entity === localPlayer || this.entity.id === localPlayer.id);
            
            
            if (isLocalPlayer && !classesInitialized && this.model) {
                initializeClasses(this.model);
            }

            if (isLocalPlayer && currentMorph && currentMorph.modelClass && classesInitialized) {
                const ModelClass = currentMorph.modelClass;
                
                
                if (!this.model || forceRebuild || !(this.model instanceof ModelClass)) {
                    this.clear(); 
                    try {
                        
                        this.model = new ModelClass(this); 
                        
                        
                        if (!this.model.setArmor) this.model.setArmor = function() {};
                        this.model.addHat = function() {};

                        this.add(this.model);
                        
                        
                        
                        
                    } catch (err) {
                        console.error("[MorphMod] Error creating mob model:", err);
                        return originalGetModel.call(this, forceRebuild);
                    }
                }
                return this.model;
            }
            
            return originalGetModel.call(this, forceRebuild);
        };
    }

    
    function removeChristmasHat() {
        try {
            const game = window.game || window.Game;
            const player = game?.gameScene?.player || game?.player;
            if (player && player.model) {
                const ModelClass = player.model.constructor;
                if (ModelClass.prototype.addHat) {
                    ModelClass.prototype.addHat = function() {};
                }
                if (player.model.hatMesh && player.model.meshes && player.model.meshes.head) {
                    player.model.meshes.head.remove(player.model.hatMesh);
                    player.model.hatMesh = null;
                }
            } else {
                setTimeout(removeChristmasHat, 1000);
            }
        } catch (e) {}
    }

    
    function injectSettingsButton() {
        if (document.getElementById('morph-mod-entry-btn')) return;
        const keywords = ["Video Settings", "Graphics", "Configuración de Video", "Gráficos", "FOV", "Render Distance"];
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        let targetContainer = null, referenceBtn = null;

        for (const btn of buttons) {
            if (btn.innerText && keywords.some(k => btn.innerText.includes(k))) {
                referenceBtn = btn;
                targetContainer = btn.parentElement;
                break;
            }
        }

        if (targetContainer) {
            const btn = document.createElement('button');
            btn.id = 'morph-mod-entry-btn';
            btn.innerText = 'Morph Mod';
            if (referenceBtn) {
                btn.className = referenceBtn.className;
                btn.style.cssText = referenceBtn.style.cssText;
            }
            btn.style.marginTop = '5px';
            btn.style.marginBottom = '5px';
            btn.style.width = '100%';
            btn.style.backgroundColor = '#4a0080'; 
            btn.style.color = 'white';
            btn.style.fontFamily = 'Faithful, sans-serif'; 
            btn.style.textShadow = '2px 2px 0px #000';
            btn.onclick = togglePanel;
            targetContainer.appendChild(btn);
        }
    }

    function createUI() {
        const oldPanel = document.getElementById('morph-mod-panel');
        if (oldPanel) oldPanel.remove();
        
        const panel = document.createElement('div');
        panel.id = 'morph-mod-panel';
        panel.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85); display: none; z-index: 2147483647; 
            flex-direction: column; align-items: center; justify-content: center;
            font-family: 'Faithful', sans-serif; color: white; backdrop-filter: blur(2px);
        `;
        
        let buttonsHtml = '';
        MOBS.forEach((mob) => {
            buttonsHtml += `
                <button class="morph-btn" data-name="${mob.name}" style="
                    width: 200px; margin: 5px; padding: 10px; cursor: pointer;
                    background: #222; color: white; border: 2px solid #555; 
                    font-family: 'Faithful', sans-serif; font-size: 16px;
                    text-shadow: 1px 1px 0 #000; box-shadow: 0 4px 0 #000;
                    position: relative; top: 0; transition: top 0.1s, box-shadow 0.1s;
                " onmouseover="this.style.background='#333'" onmouseout="this.style.background='#222'"
                onmousedown="this.style.top='4px'; this.style.boxShadow='0 0 0 #000'"
                onmouseup="this.style.top='0'; this.style.boxShadow='0 4px 0 #000'">
                    ${mob.name}
                    <span style="display:block; font-size: 10px; color: #aaa; margin-top:2px;">${mob.type}</span>
                </button>
            `;
        });

        panel.innerHTML = `
            <h2 style="font-size: 32px; margin-bottom: 20px; text-shadow: 3px 3px 0 #000; color: #a349a4;">Morph Mod</h2>
            <div id="morph-list" style="
                display: flex; flex-wrap: wrap; justify-content: center; 
                max-width: 800px; max-height: 60vh; overflow-y: auto; padding: 10px; gap: 10px;
            ">
                ${buttonsHtml}
            </div>
            <div style="margin-top: 30px; display: flex; gap: 20px;">
                <button id="morph-reset" style="
                    width: 200px; padding: 12px; cursor: pointer;
                    background: #8b0000; color: white; border: 2px solid #fff; 
                    font-family: 'Faithful', sans-serif; font-size: 18px;
                    text-shadow: 2px 2px 0 #000; box-shadow: 0 4px 0 #000;
                ">Reset Player</button>
                <button id="morph-close" style="
                    width: 200px; padding: 12px; cursor: pointer;
                    background: #444; color: white; border: 2px solid #fff; 
                    font-family: 'Faithful', sans-serif; font-size: 18px;
                    text-shadow: 2px 2px 0 #000; box-shadow: 0 4px 0 #000;
                ">Done</button>
            </div>
        `;
        document.body.appendChild(panel);

        panel.querySelectorAll('.morph-btn').forEach(btn => {
            btn.onclick = () => {
                const name = btn.getAttribute('data-name');
                const mob = MOBS.find(m => m.name === name);
                if (mob) {
                    applyMorph(mob);
                    panel.querySelectorAll('.morph-btn').forEach(b => b.style.borderColor = '#555');
                    btn.style.borderColor = '#00ff00';
                }
            };
        });

        document.getElementById('morph-reset').onclick = () => applyMorph(MOBS[0]);
        document.getElementById('morph-close').onclick = togglePanel;
    }

    function togglePanel() {
        const panel = document.getElementById('morph-mod-panel');
        uiVisible = !uiVisible;
        panel.style.display = uiVisible ? 'flex' : 'none';
    }

    function applyMorph(mob) {
        currentMorph = mob;
        console.log(`[MorphMod] Selected ${mob.name}`);
        triggerRecreate(mob);
    }

    function triggerRecreate(mob) {
        const p = getLocalPlayer();
        const mesh = getPlayerMesh(p);
        if (mesh && mesh.recreate) {
            mesh.recreate();
            if (mesh.scale) mesh.scale.set(1, 1, 1);
        }
    }

    
    const init = () => {
        if (window.morphModInitialized) return;
        window.morphModInitialized = true;
        
        try {
            createUI();
            const observer = new MutationObserver(() => injectSettingsButton());
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}

        const waitForGame = () => {
            if (!window.RenderPlayer || !getLocalPlayer()) {
                setTimeout(waitForGame, 500);
                return;
            }
            hookRenderPlayer();
            removeChristmasHat();
            console.log("[MorphMod] Ready.");
        };
        
        waitForGame();
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
        window.addEventListener('load', init);
    }

    
    window.injectSettingsButton = injectSettingsButton;

})();
