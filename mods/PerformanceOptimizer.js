(function() {
    const PerformanceOptimizer = {
        gpuInfo: {
            isDedicated: false,
            isSwiftShader: false,
            renderer: 'Unknown',
            vendor: 'Unknown',
            firmwareHint: 'Unknown'
        },
        settings: {
            deferredLoading: true,
            maxConcurrentLoads: 2,
            loadDelay: 500,
            lowPowerMode: false,
            preferDedicated: true
        },
        loadQueue: [],
        taskQueue: [],
        isProcessingQueue: false,
        isProcessingTasks: false,
        eventLoopLag: 0,

        init() {
            this.detectGPU();
            this.applyOptimizations();
            this.setupHooks();
            this.monitorLag();
            this.startTaskProcessor();
            this.setupLOD();
            this.hookChunkSystem();
            this.unlockRenderDistance();
            
            console.log('%c[PerformanceOptimizer] Hardware Diagnostic:', 'color: #00ff00; font-weight: bold;');
            console.log(' - GPU: ' + this.gpuInfo.renderer);
            console.log(' - Vendor: ' + this.gpuInfo.vendor);
            console.log(' - Type: ' + (this.gpuInfo.isDedicated ? 'Dedicated (High Performance)' : (this.gpuInfo.isSwiftShader ? 'Software (LAG WARNING)' : 'Integrated')));
            console.log(' - Firmware/API: ' + this.gpuInfo.firmwareHint);
        },

        
        waitForThreeJS() {
            const check = () => {
                if (typeof THREE !== 'undefined') {
                    console.log('[PerformanceOptimizer] THREE.js detected. Injecting render optimizations...');
                    this.hookThreeJS();
                } else {
                    setTimeout(check, 1000);
                }
            };
            check();
        },

        hookThreeJS() {
            
            const originalRender = THREE.WebGLRenderer.prototype.render;
            const self = this;

            THREE.WebGLRenderer.prototype.render = function(scene, camera) {
                
                if (this.shadowMap && (self.settings.lowPowerMode || window.perfConfig?.disableShadows)) {
                    this.shadowMap.enabled = false;
                    this.shadowMap.autoUpdate = false;
                }
                
                
                
                

                
                if (scene && !scene.userData.optimized) {
                    scene.traverse((object) => {
                        if (object.isMesh) {
                            
                            if (window.perfConfig?.disableShadows) {
                                object.castShadow = false;
                                object.receiveShadow = false;
                            }
                            
                            
                            
                            if (object.userData.static || object.name.includes('Chunk') || object.name.includes('World')) {
                                object.matrixAutoUpdate = false;
                                object.updateMatrix();
                            }
                        }
                    });
                    scene.userData.optimized = true;
                }

                return originalRender.apply(this, arguments);
            };

            
            
            window.ObjectPool = class ObjectPool {
                constructor(createFn, initialSize = 10) {
                    this.createFn = createFn;
                    this.pool = [];
                    for (let i = 0; i < initialSize; i++) {
                        this.pool.push(this.createFn());
                    }
                }
                
                get() {
                    return this.pool.length > 0 ? this.pool.pop() : this.createFn();
                }
                
                release(obj) {
                    this.pool.push(obj);
                }
            };

            console.log('[PerformanceOptimizer] Three.js hooks active: Shadows disabled, Pooling system ready.');
        },

        scheduleTask(task, priority = 'low') {
            this.taskQueue.push({ task, priority, added: performance.now() });
            this.taskQueue.sort((a, b) => {
                if (a.priority === 'high' && b.priority !== 'high') return -1;
                if (a.priority !== 'high' && b.priority === 'high') return 1;
                return a.added - b.added;
            });
        },

        startTaskProcessor() {
            const process = async () => {
                if (this.taskQueue.length > 0 && !this.isHighLoad && this.eventLoopLag < 10) {
                    const { task } = this.taskQueue.shift();
                    try {
                        
                        if (window.requestIdleCallback) {
                            window.requestIdleCallback((deadline) => {
                                
                                if (task.constructor.name === 'GeneratorFunction') {
                                    this.processGeneratorTask(task(), deadline);
                                } else {
                                    task();
                                }
                            });
                        } else {
                            task();
                        }
                    } catch (e) {
                        console.error('[PerformanceOptimizer] Task error:', e);
                    }
                }
                setTimeout(process, this.gpuInfo.isDedicated ? 16 : 32);
            };
            process();
        },

        async processGeneratorTask(iterator, deadline) {
            let result = iterator.next();
            while (!result.done && (deadline ? deadline.timeRemaining() > 1 : true)) {
                result = iterator.next();
                if (deadline && deadline.timeRemaining() <= 1) {
                    
                    this.scheduleTask(function* () {
                        yield* iterator;
                    }, 'high');
                    break;
                }
            }
        },

        monitorLag() {
            let lastTime = performance.now();
            const checkLag = () => {
                const now = performance.now();
                const delta = now - lastTime;
                lastTime = now;
                
                
                this.eventLoopLag = Math.max(0, delta - 16.7);
                
                setTimeout(checkLag, 16);
            };
            checkLag();
        },

        detectGPU() {
            try {
                
                const originalGetContext = HTMLCanvasElement.prototype.getContext;
                const self = this;
                
                HTMLCanvasElement.prototype.getContext = function(type, attributes) {
                    if ((type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && self.settings.preferDedicated) {
                        attributes = attributes || {};
                        
                        attributes.powerPreference = 'high-performance';
                        attributes.desynchronized = true;
                    }
                    return originalGetContext.call(this, type, attributes);
                };

                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl', { powerPreference: 'high-performance' }) || 
                           canvas.getContext('experimental-webgl', { powerPreference: 'high-performance' });
                
                if (!gl) return;

                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    this.gpuInfo.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    this.gpuInfo.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                } else {
                    this.gpuInfo.renderer = gl.getParameter(gl.RENDERER);
                    this.gpuInfo.vendor = gl.getParameter(gl.VENDOR);
                }

                const renderer = this.gpuInfo.renderer.toLowerCase();
                const vendor = this.gpuInfo.vendor.toLowerCase();

                
                this.gpuInfo.isSwiftShader = renderer.includes('swiftshader') || 
                                             renderer.includes('llvmpipe') || 
                                             renderer.includes('software adapter') ||
                                             vendor.includes('google inc.') && renderer.includes('angle');

                
                const dedicatedKeywords = ['nvidia', 'geforce', 'quadro', 'amd', 'radeon', 'rtx', 'gtx', 'titan', 'adreno', 'mali'];
                const integratedKeywords = ['intel', 'graphics', 'hd graphics', 'uhd', 'iris', 'integrated', 'microsoft basic render'];

                this.gpuInfo.isDedicated = dedicatedKeywords.some(k => renderer.includes(k) || vendor.includes(k)) &&
                                          !integratedKeywords.some(k => renderer.includes(k)) &&
                                          !this.gpuInfo.isSwiftShader;

                
                const firmwareMatch = renderer.match(/(?:direct3d\d+|vulkan|opengl|metal|angle)/i);
                this.gpuInfo.firmwareHint = firmwareMatch ? firmwareMatch[0].toUpperCase() : 'Unknown';

                if (this.gpuInfo.isSwiftShader) {
                    console.warn('[PerformanceOptimizer] CRITICAL: SwiftShader detected. Performance will be poor.');
                    this.applyExtremeOptimizations();
                } else if (!this.gpuInfo.isDedicated) {
                    this.settings.deferredLoading = true;
                    this.settings.maxConcurrentLoads = 1;
                    this.settings.loadDelay = 1000;
                    this.settings.lowPowerMode = true;
                    console.log('[PerformanceOptimizer] Integrated GPU detected. Optimizing for battery/stability.');
                } else {
                    console.log('[PerformanceOptimizer] Dedicated GPU detected (' + this.gpuInfo.firmwareHint + '). Full power mode.');
                }
            } catch (e) {
                console.error('[PerformanceOptimizer] Error detecting GPU:', e);
            }
        },

        applyExtremeOptimizations() {
            this.settings.deferredLoading = true;
            this.settings.maxConcurrentLoads = 1;
            this.settings.loadDelay = 2000;
            this.settings.lowPowerMode = true;
            
            
            window.perfConfig = window.perfConfig || {};
            window.perfConfig.disableShadows = true;
            window.perfConfig.lowResTextures = true;
            window.perfConfig.disableParticles = true;
            
            
            const style = document.createElement('style');
            style.textContent = `
                * { text-shadow: none !important; box-shadow: none !important; }
                canvas { image-rendering: pixelated; }
            `;
            document.head.appendChild(style);
        },

        applyOptimizations() {
            
            const originalRAF = window.requestAnimationFrame;
            let lastFrameTime = performance.now();
            
            window.requestAnimationFrame = (callback) => {
                return originalRAF((time) => {
                    const frameDuration = time - lastFrameTime;
                    lastFrameTime = time;

                    
                    if (frameDuration > 20) {
                        this.isHighLoad = true;
                    } else {
                        this.isHighLoad = false;
                    }
                    
                    callback(time);
                });
            };

            
            this.idleWork = (task) => {
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(task, { timeout: 2000 });
                } else {
                    setTimeout(task, 1);
                }
            };
        },

        setupHooks() {
            
            const self = this;
            const OriginalImage = window.Image;
            
            window.Image = function() {
                const img = new OriginalImage();
                const originalSetSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
                
                Object.defineProperty(img, 'src', {
                    set: function(url) {
                        if (self.shouldDefer(url)) {
                            self.queueAsset(() => originalSetSrc.call(this, url));
                        } else {
                            originalSetSrc.call(this, url);
                        }
                    }
                });
                return img;
            };
        },

        shouldDefer(url) {
            if (!this.settings.deferredLoading) return false;
            
            
            const deferredExtensions = ['.gif', '.mp4', '.webp', '.png'];
            const deferredPaths = ['memes/', 'texturepacks/'];
            
            return deferredExtensions.some(ext => url.toLowerCase().endsWith(ext)) ||
                   deferredPaths.some(path => url.includes(path));
        },

        queueAsset(loadFn) {
            this.loadQueue.push(loadFn);
            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        },

        async processQueue() {
            if (this.loadQueue.length === 0) {
                this.isProcessingQueue = false;
                return;
            }

            this.isProcessingQueue = true;

            
            if (this.isHighLoad || this.eventLoopLag > 5) {
                const waitTime = this.gpuInfo.isDedicated ? 100 : 300;
                await new Promise(r => setTimeout(r, waitTime));
                return this.processQueue();
            }

            const tasks = this.loadQueue.splice(0, this.settings.maxConcurrentLoads);
            
            for (const task of tasks) {
                this.idleWork(task);
            }

            await new Promise(r => setTimeout(r, this.settings.loadDelay));
            this.processQueue();
        },

        setupLOD() {
            console.log('[PerformanceOptimizer] Starting LOD system...');
            setInterval(() => this.updateLOD(), 500);
        },

        unlockRenderDistance() {
             const key = "Render Distance ";
             
             const current = localStorage.getItem(key);
             if (current && parseInt(current) < 32) {
                 console.log('[PerformanceOptimizer] Forcing render distance to 32 chunks...');
                 localStorage.setItem(key, "32");
             }
        },

        updateLOD() {
            if (!window.game || !window.game.chunkRenderManager || !window.game.player) return;

            const playerPos = window.game.player.pos;
            const chunkManager = window.game.chunkRenderManager;
            const meshes = chunkManager.meshes; 
            if (!meshes) return;

            const LOW_QUALITY_DIST_SQ = (8 * 16) ** 2;

            
            let meshEntries = [];
            if (meshes instanceof Map) {
                meshEntries = meshes.entries();
            } else if (Array.isArray(meshes)) {
                 
                 
                 
                 
                 meshEntries = meshes.entries ? meshes.entries() : Object.entries(meshes);
            } else {
                meshEntries = Object.entries(meshes);
            }

            for (const [key, meshData] of meshEntries) {
                if (!meshData || !meshData.pos) continue;
                
                const cx = meshData.pos.x * 16 + 8;
                const cz = meshData.pos.z * 16 + 8;
                
                const dx = cx - playerPos.x;
                const dz = cz - playerPos.z;
                const distSq = dx*dx + dz*dz;

                const isFar = distSq > LOW_QUALITY_DIST_SQ;
                
                if (isFar) {
                    if (meshData.opaque) {
                        meshData.opaque.castShadow = false;
                        meshData.opaque.receiveShadow = false;
                        meshData.opaque.matrixAutoUpdate = false;
                    }
                    if (meshData.transparent) {
                        meshData.transparent.castShadow = false;
                        meshData.transparent.receiveShadow = false;
                        meshData.transparent.matrixAutoUpdate = false;
                    }
                } else {
                    if (meshData.opaque && !window.perfConfig?.disableShadows) {
                         meshData.opaque.castShadow = true;
                         meshData.opaque.receiveShadow = true;
                    }
                }
            }
        }
    };

    PerformanceOptimizer.init();
    window.PerformanceOptimizer = PerformanceOptimizer;
})();
