(function() {
    console.log("[SkinLayers3D] Cargando v1.2...");

    const CONFIG = {
        voxelSize: 1.0, 
        extrudeScale: 0.125, // 1/8 de unidad
        shellOffset: 0.35
    };

    const processedRoots = new WeakSet();
    const textureCanvas = document.createElement('canvas');
    const textureCtx = textureCanvas.getContext('2d', { willReadFrequently: true });

    // Definición de capas (Layout estándar 64x64)
    const LAYERS = {
        head: {
            size: [8, 8, 8],
            parts: {
                top:    { u: 40, v: 0, w: 8, h: 8,  pos: [0, 8, 0],   rot: [-Math.PI/2, 0, 0] },
                bottom: { u: 48, v: 0, w: 8, h: 8,  pos: [0, 0, 0],   rot: [Math.PI/2, 0, 0] },
                right:  { u: 32, v: 8, w: 8, h: 8,  pos: [-4, 4, 0],  rot: [0, -Math.PI/2, 0] },
                front:  { u: 40, v: 8, w: 8, h: 8,  pos: [0, 4, 4],   rot: [0, 0, 0] },
                left:   { u: 48, v: 8, w: 8, h: 8,  pos: [4, 4, 0],   rot: [0, Math.PI/2, 0] },
                back:   { u: 56, v: 8, w: 8, h: 8,  pos: [0, 4, -4],  rot: [0, Math.PI, 0] }
            }
        },
        body: { // Jacket
            size: [8, 12, 4],
            parts: {
                top:    { u: 20, v: 32, w: 8, h: 4, pos: [0, 12, 0],  rot: [-Math.PI/2, 0, 0] },
                bottom: { u: 28, v: 32, w: 8, h: 4, pos: [0, 0, 0],   rot: [Math.PI/2, 0, 0] },
                right:  { u: 16, v: 36, w: 4, h: 12, pos: [-4, 6, 0], rot: [0, -Math.PI/2, 0] },
                front:  { u: 20, v: 36, w: 8, h: 12, pos: [0, 6, 2],  rot: [0, 0, 0] },
                left:   { u: 28, v: 36, w: 4, h: 12, pos: [4, 6, 0],  rot: [0, Math.PI/2, 0] },
                back:   { u: 32, v: 36, w: 8, h: 12, pos: [0, 6, -2], rot: [0, Math.PI, 0] }
            }
        },
        leftArm: { 
            size: [4, 12, 4],
            parts: {
                top:    { u: 52, v: 48, w: 4, h: 4, pos: [0, 12, 0],  rot: [-Math.PI/2, 0, 0] },
                bottom: { u: 56, v: 48, w: 4, h: 4, pos: [0, 0, 0],   rot: [Math.PI/2, 0, 0] },
                right:  { u: 48, v: 52, w: 4, h: 12, pos: [-2, 6, 0], rot: [0, -Math.PI/2, 0] },
                front:  { u: 52, v: 52, w: 4, h: 12, pos: [0, 6, 2],  rot: [0, 0, 0] },
                left:   { u: 56, v: 52, w: 4, h: 12, pos: [2, 6, 0],  rot: [0, Math.PI/2, 0] },
                back:   { u: 60, v: 52, w: 4, h: 12, pos: [0, 6, -2], rot: [0, Math.PI, 0] }
            }
        },
        rightArm: { 
            size: [4, 12, 4],
            parts: {
                top:    { u: 44, v: 32, w: 4, h: 4, pos: [0, 12, 0],  rot: [-Math.PI/2, 0, 0] },
                bottom: { u: 48, v: 32, w: 4, h: 4, pos: [0, 0, 0],   rot: [Math.PI/2, 0, 0] },
                right:  { u: 40, v: 36, w: 4, h: 12, pos: [-2, 6, 0], rot: [0, -Math.PI/2, 0] },
                front:  { u: 44, v: 36, w: 4, h: 12, pos: [0, 6, 2],  rot: [0, 0, 0] },
                left:   { u: 48, v: 36, w: 4, h: 12, pos: [2, 6, 0],  rot: [0, Math.PI/2, 0] },
                back:   { u: 52, v: 36, w: 4, h: 12, pos: [0, 6, -2], rot: [0, Math.PI, 0] }
            }
        },
        leftLeg: { 
            size: [4, 12, 4],
            parts: {
                top:    { u: 4, v: 48, w: 4, h: 4, pos: [0, 12, 0],   rot: [-Math.PI/2, 0, 0] },
                bottom: { u: 8, v: 48, w: 4, h: 4, pos: [0, 0, 0],    rot: [Math.PI/2, 0, 0] },
                right:  { u: 0, v: 52, w: 4, h: 12, pos: [-2, 6, 0],  rot: [0, -Math.PI/2, 0] },
                front:  { u: 4, v: 52, w: 4, h: 12, pos: [0, 6, 2],   rot: [0, 0, 0] },
                left:   { u: 8, v: 52, w: 4, h: 12, pos: [2, 6, 0],   rot: [0, Math.PI/2, 0] },
                back:   { u: 12, v: 52, w: 4, h: 12, pos: [0, 6, -2], rot: [0, Math.PI, 0] }
            }
        },
        rightLeg: { 
            size: [4, 12, 4],
            parts: {
                top:    { u: 4, v: 32, w: 4, h: 4, pos: [0, 12, 0],   rot: [-Math.PI/2, 0, 0] },
                bottom: { u: 8, v: 32, w: 4, h: 4, pos: [0, 0, 0],    rot: [Math.PI/2, 0, 0] },
                right:  { u: 0, v: 36, w: 4, h: 12, pos: [-2, 6, 0],  rot: [0, -Math.PI/2, 0] },
                front:  { u: 4, v: 36, w: 4, h: 12, pos: [0, 6, 2],   rot: [0, 0, 0] },
                left:   { u: 8, v: 36, w: 4, h: 12, pos: [2, 6, 0],   rot: [0, Math.PI/2, 0] },
                back:   { u: 12, v: 36, w: 4, h: 12, pos: [0, 6, -2], rot: [0, Math.PI, 0] }
            }
        }
    };

    // Variables globales para debug
    let debugDiv = null;
    let taintWarned = false;
    let threeLike = null;

    function log(msg) {
        console.log(`[SkinLayers3D] ${msg}`);
        if (debugDiv) {
            debugDiv.innerText = `SkinLayers v1.2: ${msg}`;
        }
    }

    function init() {
        console.log("[SkinLayers3D] Iniciado.");
        
        // Indicador visual de carga (Debug) - CENTER LEFT
        debugDiv = document.createElement('div');
        debugDiv.style.cssText = "position:fixed; top:50%; left:10px; transform:translateY(-50%); background:rgba(0,0,0,0.8); color:#00ff00; padding:15px; z-index:99999; font-family:monospace; font-size:16px; font-weight:bold; pointer-events:none; border: 2px solid #00ff00; border-radius: 8px; box-shadow: 0 0 10px #00ff00;";
        debugDiv.innerText = "SkinLayers v1.2: Iniciando...";
        document.body.appendChild(debugDiv);

        startScanning();

        if (typeof THREE === 'undefined') {
            console.warn("[SkinLayers3D] THREE.js no encontrado. Intentando cargar desde CDN...");
            debugDiv.innerText = "SkinLayers v1.2: Intentando cargar THREE.js...";

            const cdnUrls = [
                "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.150.1/three.min.js",
                "https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js",
                "https://unpkg.com/three@0.150.1/build/three.min.js"
            ];

            const tryLoad = (i) => {
                if (i >= cdnUrls.length) {
                    debugDiv.innerText = "SkinLayers v1.2: THREE.js no disponible (usando fallback).";
                    return;
                }
                const script = document.createElement('script');
                script.src = cdnUrls[i];
                script.crossOrigin = "anonymous";
                script.onload = () => {
                    console.log("[SkinLayers3D] THREE.js cargado exitosamente.");
                    debugDiv.innerText = "SkinLayers v1.2: THREE.js cargado.";
                };
                script.onerror = (e) => {
                    console.error("[SkinLayers3D] Falló la carga de THREE.js desde CDN.", e);
                    tryLoad(i + 1);
                };
                document.head.appendChild(script);
            };

            tryLoad(0);
        }
    }

    function startScanning() {
        setInterval(scanAndEnhance, 750);
    }

    // --- Lógica de detección de jugadores (Basada en Titan & Tiny) ---
    function getLocalPlayer() {
        try {
            if (window.Game && window.Game.player) return window.Game.player;
            if (window.game && window.game.player) return window.game.player;
            if (window.gameInstance && window.gameInstance.player) return window.gameInstance.player;
            if (window.player) return window.player;
        } catch (err) {
            console.warn("[SkinLayers3D] Error buscando jugador local:", err);
        }
        return null;
    }

    function getPlayerModel(entity) {
        if (!entity) return null;
        let model = null;
        if (typeof entity.getClientModel === 'function') {
            try { model = entity.getClientModel(); } catch (e) {}
        }
        if (!model && entity.mesh) model = entity.mesh;
        return model;
    }

    function getScene() {
        const direct = window.gameScene;
        if (direct && (direct.isScene || typeof direct.traverse === 'function')) return direct;

        const candidates = [
            window.scene,
            window.Scene,
            window.worldScene,
            window.WorldScene,
            window.game && window.game.scene,
            window.Game && window.Game.scene,
            window.gameInstance && window.gameInstance.scene,
            window.renderer && window.renderer.scene,
            window.Renderer && window.Renderer.scene
        ];

        for (let i = 0; i < candidates.length; i++) {
            const s = candidates[i];
            if (s && (s.isScene || typeof s.traverse === 'function')) {
                window.gameScene = s;
                return s;
            }
        }
        return null;
    }

    function getThreeLike(scene) {
        if (window.THREE) return window.THREE;
        if (threeLike) return threeLike;

        let sample = null;
        scene.traverse(obj => {
            if (sample) return;
            if (!obj || !obj.isMesh || obj.isSkinnedMesh) return;
            if (!obj.geometry || !obj.material) return;
            if (!obj.position || !obj.rotation) return;
            const attr = obj.geometry.getAttribute && obj.geometry.getAttribute('position');
            if (!attr || !attr.array) return;
            sample = obj;
        });

        if (!sample) return null;

        const Vector3 = sample.position.constructor;
        const Euler = sample.rotation.constructor;
        const BufferGeometry = sample.geometry.constructor;
        const Float32BufferAttribute = sample.geometry.getAttribute('position').constructor;
        const Mesh = sample.constructor;
        const MeshBasicMaterial = sample.material.constructor;

        if (!Vector3 || !Euler || !BufferGeometry || !Float32BufferAttribute || !Mesh || !MeshBasicMaterial) return null;

        threeLike = { Vector3, Euler, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial };
        return threeLike;
    }

    function materialToMap(material) {
        if (!material) return null;
        if (Array.isArray(material)) {
            for (let i = 0; i < material.length; i++) {
                const m = material[i];
                if (m && m.map) return m.map;
            }
            return null;
        }
        return material.map || null;
    }

    function isSkinLikeTexture(map) {
        const img = map && map.image;
        if (!img) return false;
        const w = img.width || 0;
        const h = img.height || 0;
        return (w === 64 && h === 64) || (w === 64 && h === 32) || (w === 128 && h === 128) || (w === 128 && h === 64);
    }

    function countMeshes(root, limit) {
        let count = 0;
        const stack = [root];
        while (stack.length) {
            const obj = stack.pop();
            if (!obj) continue;
            if (obj.isMesh || obj.isSkinnedMesh) {
                count++;
                if (count > limit) return count;
            }
            const ch = obj.children;
            if (ch && ch.length) {
                for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
            }
        }
        return count;
    }

    function findCandidateRootFromMesh(mesh, scene) {
        let cur = mesh;
        let best = null;
        for (let i = 0; i < 6 && cur && cur.parent; i++) {
            if (cur === scene) break;
            const parent = cur.parent;
            if (!parent || parent === scene) break;
            const c = countMeshes(parent, 16);
            if (c >= 2 && c <= 14) best = parent;
            cur = parent;
        }
        return best || (mesh.parent && mesh.parent !== scene ? mesh.parent : null);
    }

    function scanAndEnhance() {
        const scene = getScene();
        if (!scene) {
            if (debugDiv) debugDiv.innerText = "SkinLayers v1.2: Esperando escena...";
            return;
        }

        const THREE = getThreeLike(scene);
        if (!THREE) {
            if (debugDiv) debugDiv.innerText = "SkinLayers v1.2: Esperando motor 3D...";
            return;
        }

        let found = 0;
        let attempted = 0;

        const localEntity = getLocalPlayer();
        if (localEntity) {
            const localMesh = getPlayerModel(localEntity);
            if (localMesh && (localMesh.isObject3D || localMesh.isMesh || localMesh.isGroup) && !processedRoots.has(localMesh)) {
                attempted++;
                if (enhancePlayer(localMesh, THREE)) {
                    processedRoots.add(localMesh);
                    found++;
                }
            }
        }

        scene.traverse(obj => {
            if (!(obj.isMesh || obj.isSkinnedMesh)) return;
            if (!obj.geometry || !obj.material) return;
            const map = materialToMap(obj.material);
            if (!map || !isSkinLikeTexture(map)) return;

            const root = findCandidateRootFromMesh(obj, scene);
            if (!root || processedRoots.has(root)) return;

            attempted++;
            if (enhancePlayer(root, THREE)) {
                processedRoots.add(root);
                found++;
            }
        });
        
        if (found > 0) {
            log(`Aplicado a ${found} modelo(s). Intentos: ${attempted}.`);
        } else {
            if (debugDiv) debugDiv.innerText = `SkinLayers v1.2: Buscando modelos... (Intentos: ${attempted})`;
        }
    }

    function enhancePlayer(playerGroup, THREE) {
        const parts = identifyPartsDeep(playerGroup, THREE);
        const headOrAny = parts.head || parts.body || parts.leftArm || parts.rightArm || parts.leftLeg || parts.rightLeg;
        if (!headOrAny) return false;

        const map = materialToMap(headOrAny.material);
        if (!map || !map.image) return false;
        const img = map.image;
        if (!img.complete) {
            img.onload = () => enhancePlayer(playerGroup, THREE);
            return false;
        }

        let imgData = null;
        try {
            textureCanvas.width = img.width;
            textureCanvas.height = img.height;
            textureCtx.clearRect(0, 0, img.width, img.height);
            textureCtx.drawImage(img, 0, 0);
            imgData = textureCtx.getImageData(0, 0, img.width, img.height);
        } catch (e) {
            imgData = null;
            if (!taintWarned) {
                taintWarned = true;
                log("No se pudo leer la textura (CORS). Usando capa tipo shell.");
            }
        }

        const partNames = ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
        for (let i = 0; i < partNames.length; i++) {
            const partName = partNames[i];
            const mesh = parts[partName];
            if (!mesh) continue;

            const layerDef = LAYERS[partName];
            const existing = mesh.getObjectByName("SkinLayer3D");
            if (existing) mesh.remove(existing);

            const layerMesh = imgData
                ? createMergedLayer(layerDef, imgData, THREE, mesh)
                : createShellLayer(layerDef, THREE, mesh);

            if (layerMesh) {
                layerMesh.name = "SkinLayer3D";
                mesh.add(layerMesh);
            }
        }

        return true;
    }

    function getMeshSize(mesh, THREE) {
        if (!mesh.geometry) return null;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        if (!mesh.geometry.boundingBox) return null;
        const size = new THREE.Vector3();
        mesh.geometry.boundingBox.getSize(size);
        size.x *= Math.abs(mesh.scale.x || 1);
        size.y *= Math.abs(mesh.scale.y || 1);
        size.z *= Math.abs(mesh.scale.z || 1);
        return size;
    }

    function identifyPartsDeep(root, THREE) {
        const meshes = [];
        root.updateWorldMatrix(true, true);
        root.traverse(obj => {
            if (!(obj.isMesh || obj.isSkinnedMesh)) return;
            if (!obj.geometry || !obj.material) return;
            if (obj.name === "SkinLayer3D") return;
            const map = materialToMap(obj.material);
            if (!map || !map.image) return;
            meshes.push(obj);
        });

        if (meshes.length === 0) return {};

        const items = meshes.map(m => {
            const size = getMeshSize(m, THREE) || new THREE.Vector3(0, 0, 0);
            const pos = new THREE.Vector3();
            m.getWorldPosition(pos);
            return { mesh: m, size, pos };
        });

        items.sort((a, b) => b.pos.y - a.pos.y);

        const parts = {};

        const cubeScore = (s) => {
            const mx = Math.max(s.x, s.y, s.z) || 1;
            const mn = Math.min(s.x, s.y, s.z) || 1;
            const ratio = mn / mx;
            return ratio;
        };

        let headCandidate = null;
        for (let i = 0; i < items.length; i++) {
            if (cubeScore(items[i].size) > 0.80) {
                headCandidate = items[i];
                break;
            }
        }
        if (!headCandidate) headCandidate = items[0];
        parts.head = headCandidate.mesh;

        let bodyCandidate = null;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.mesh === parts.head) continue;
            if (it.pos.y >= headCandidate.pos.y) continue;
            if (it.size.y <= 0) continue;
            const slender = it.size.y / Math.max(it.size.x, it.size.z, 0.0001);
            if (slender > 1.2) {
                bodyCandidate = it;
                break;
            }
        }
        if (bodyCandidate) parts.body = bodyCandidate.mesh;

        const remaining = items.filter(it => it.mesh !== parts.head && it.mesh !== parts.body);
        if (!parts.body) {
            remaining.sort((a, b) => b.size.y - a.size.y);
        }

        const bodyY = bodyCandidate ? bodyCandidate.pos.y : (headCandidate.pos.y - 1);
        const arms = [];
        const legs = [];
        for (let i = 0; i < remaining.length; i++) {
            const it = remaining[i];
            if (it.pos.y > bodyY - 0.1) arms.push(it);
            else legs.push(it);
        }

        const pickLR = (arr) => {
            if (arr.length < 2) return;
            arr.sort((a, b) => a.pos.x - b.pos.x);
            const left = arr[arr.length - 1];
            const right = arr[0];
            return { left, right };
        };

        const armLR = pickLR(arms);
        if (armLR) {
            parts.leftArm = armLR.left.mesh;
            parts.rightArm = armLR.right.mesh;
        }

        const legLR = pickLR(legs);
        if (legLR) {
            parts.leftLeg = legLR.left.mesh;
            parts.rightLeg = legLR.right.mesh;
        }

        return parts;
    }

    function createMergedLayer(layerDef, imgData, THREE, parentMesh) {
        parentMesh.geometry.computeBoundingBox();
        const bbox = parentMesh.geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const scaleX = size.x / layerDef.size[0];
        const scaleY = size.y / layerDef.size[1];
        const scaleZ = size.z / layerDef.size[2];

        const vertices = [];
        const uvs = [];
        const indices = [];
        let vertexOffset = 0;

        Object.keys(layerDef.parts).forEach(faceName => {
            const part = layerDef.parts[faceName];
            const rot = new THREE.Euler(...part.rot);
            const pos = new THREE.Vector3(...part.pos);
            
            const right = new THREE.Vector3(1, 0, 0).applyEuler(rot);
            const down = new THREE.Vector3(0, -1, 0).applyEuler(rot);
            const normal = new THREE.Vector3(0, 0, 1).applyEuler(rot);

            for (let y = 0; y < part.h; y++) {
                for (let x = 0; x < part.w; x++) {
                    const texX = part.u + x;
                    const texY = part.v + y;
                    const index = (texY * imgData.width + texX) * 4;
                    const alpha = imgData.data[index + 3];

                    if (alpha > 10) {
                        const offX = (x - part.w/2 + 0.5);
                        const offY = (y - part.h/2 + 0.5);

                        const voxelPos = pos.clone()
                            .addScaledVector(right, offX)
                            .addScaledVector(down, offY)
                            .addScaledVector(normal, 0.5);

                        const px = voxelPos.x * scaleX;
                        const py = voxelPos.y * scaleY;
                        const pz = voxelPos.z * scaleZ;
                        
                        const sx = scaleX * CONFIG.voxelSize;
                        const sy = scaleY * CONFIG.voxelSize;
                        const sz = scaleZ * CONFIG.extrudeScale;

                        const u0 = texX / imgData.width;
                        const v0 = 1 - (texY + 1) / imgData.height;
                        const u1 = (texX + 1) / imgData.width;
                        const v1 = 1 - texY / imgData.height;

                        const hw = sx/2, hh = sy/2, hd = sz/2;
                        
                        const localVerts = [
                            new THREE.Vector3(-hw, -hh, hd),
                            new THREE.Vector3(hw, -hh, hd),
                            new THREE.Vector3(hw, hh, hd),
                            new THREE.Vector3(-hw, hh, hd),
                            new THREE.Vector3(-hw, -hh, -hd),
                            new THREE.Vector3(hw, -hh, -hd),
                            new THREE.Vector3(hw, hh, -hd),
                            new THREE.Vector3(-hw, hh, -hd)
                        ];

                        localVerts.forEach(v => {
                            v.applyEuler(rot);
                            v.x += px;
                            v.y += py;
                            v.z += pz;
                        });

                        const uvCorners = [ [u0, v0], [u1, v0], [u1, v1], [u0, v1] ]; 
                        
                        const pushRotatedFace = (idxs) => {
                             idxs.forEach((idx, i) => {
                                 vertices.push(localVerts[idx].x, localVerts[idx].y, localVerts[idx].z);
                                 uvs.push(uvCorners[i][0], uvCorners[i][1]);
                             });
                             indices.push(vertexOffset, vertexOffset+1, vertexOffset+2);
                             indices.push(vertexOffset, vertexOffset+2, vertexOffset+3);
                             vertexOffset += 4;
                        };

                        pushRotatedFace([0, 1, 2, 3]);
                        pushRotatedFace([5, 4, 7, 6]);
                        pushRotatedFace([3, 2, 6, 7]);
                        pushRotatedFace([4, 5, 1, 0]);
                        pushRotatedFace([1, 5, 6, 2]);
                        pushRotatedFace([4, 0, 3, 7]);
                    }
                }
            }
        });

        if (vertices.length === 0) return null;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial({ 
            map: parentMesh.material.map, 
            transparent: true, 
            alphaTest: 0.1 
        });
        
        return new THREE.Mesh(geometry, material);
    }

    function createShellLayer(layerDef, THREE, parentMesh) {
        parentMesh.geometry.computeBoundingBox();
        const bbox = parentMesh.geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const scaleX = size.x / layerDef.size[0];
        const scaleY = size.y / layerDef.size[1];
        const scaleZ = size.z / layerDef.size[2];

        const vertices = [];
        const uvs = [];
        const indices = [];
        let vertexOffset = 0;

        const map = materialToMap(parentMesh.material);
        if (!map || !map.image) return null;
        const img = map.image;
        const texW = img.width || 64;
        const texH = img.height || 64;

        Object.keys(layerDef.parts).forEach(faceName => {
            const part = layerDef.parts[faceName];
            const rot = new THREE.Euler(...part.rot);
            const pos = new THREE.Vector3(...part.pos);

            const right = new THREE.Vector3(1, 0, 0).applyEuler(rot);
            const down = new THREE.Vector3(0, -1, 0).applyEuler(rot);
            const normal = new THREE.Vector3(0, 0, 1).applyEuler(rot);

            const center = pos.clone().addScaledVector(normal, 0.5 + CONFIG.shellOffset);

            const corners = [
                { dx: -part.w / 2, dy: -part.h / 2, uv: [part.u / texW, 1 - (part.v + part.h) / texH] },
                { dx: part.w / 2, dy: -part.h / 2, uv: [(part.u + part.w) / texW, 1 - (part.v + part.h) / texH] },
                { dx: part.w / 2, dy: part.h / 2, uv: [(part.u + part.w) / texW, 1 - part.v / texH] },
                { dx: -part.w / 2, dy: part.h / 2, uv: [part.u / texW, 1 - part.v / texH] }
            ];

            for (let i = 0; i < corners.length; i++) {
                const c = corners[i];
                const v = center.clone()
                    .addScaledVector(right, c.dx)
                    .addScaledVector(down, c.dy);
                vertices.push(v.x * scaleX, v.y * scaleY, v.z * scaleZ);
                uvs.push(c.uv[0], c.uv[1]);
            }

            indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
            indices.push(vertexOffset, vertexOffset + 2, vertexOffset + 3);
            vertexOffset += 4;
        });

        if (vertices.length === 0) return null;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial({
            map,
            transparent: true,
            alphaTest: 0.1,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        return mesh;
    }

    init();
})();
