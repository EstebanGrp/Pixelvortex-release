
(function() {
    console.log("[RedstoneFix] Loading Redstone Fix Mod v1.0...");

    
    function findGame() {
        if (window.g) return window.g;
        
        for (let key in window) {
            try {
                if (window[key] && window[key].world && window[key].setVoxel) {
                    return window[key];
                }
            } catch (e) {}
        }
        return null;
    }

    
    function findWorld() {
        const game = findGame();
        if (game && game.world) return game.world;
        if (game && game.worldObj) return game.worldObj;
        
        
        if (game && typeof game.setVoxel === 'function') return game;

        return null;
    }

    let isInitialized = false;

    function init() {
        if (isInitialized) return;

        const world = findWorld();
        if (!world) {
            
            setTimeout(init, 1000);
            return;
        }

        console.log("[RedstoneFix] World object found! Initializing logic...");

        
        
        let TNT_ID = 46; 
        let REDSTONE_BLOCK_ID = 152; 
        
        
        
        const blockRegistry = world.blockId || world.blocks || (window.g && window.g.blockId);
        
        if (blockRegistry) {
            if (blockRegistry['tnt']) TNT_ID = blockRegistry['tnt'];
            if (blockRegistry['redstone_block']) REDSTONE_BLOCK_ID = blockRegistry['redstone_block'];
            console.log(`[RedstoneFix] Resolved IDs: TNT=${TNT_ID}, Redstone=${REDSTONE_BLOCK_ID}`);
        } else if (world.blockOrder && Array.isArray(world.blockOrder)) {
            
            
            const tntIndex = world.blockOrder.indexOf('tnt');
            const redstoneIndex = world.blockOrder.indexOf('redstone_block');
            
            
            
            
            
            
            
            
            if (tntIndex !== -1) TNT_ID = tntIndex + 1; 
            if (redstoneIndex !== -1) REDSTONE_BLOCK_ID = redstoneIndex + 1;
            
            console.log(`[RedstoneFix] Inferred IDs from blockOrder: TNT=${TNT_ID}, Redstone=${REDSTONE_BLOCK_ID}`);
        } else {
            console.warn("[RedstoneFix] Could not resolve block IDs. Using defaults (may be wrong).");
        }

        
        
        const setVoxelName = world.setVoxel ? 'setVoxel' : (world.setBlock ? 'setBlock' : null);
        
        if (!setVoxelName) {
            console.error("[RedstoneFix] Could not find setVoxel method on world object.");
            return;
        }

        const originalSetVoxel = world[setVoxelName].bind(world);

        
        world[setVoxelName] = function(x, y, z, val, ...args) {
            
            const result = originalSetVoxel(x, y, z, val, ...args);

            
            
            try {
                checkExplosion(x, y, z, val, world, TNT_ID, REDSTONE_BLOCK_ID);
            } catch (e) {
                console.error("[RedstoneFix] Error in checkExplosion:", e);
            }

            return result;
        };

        isInitialized = true;
        console.log("[RedstoneFix] Redstone logic injected successfully.");
    }

    function checkExplosion(x, y, z, placedBlockId, world, TNT_ID, REDSTONE_BLOCK_ID) {
        
        const neighbors = [
            {x:1, y:0, z:0}, {x:-1, y:0, z:0},
            {x:0, y:1, z:0}, {x:0, y:-1, z:0},
            {x:0, y:0, z:1}, {x:0, y:0, z:-1}
        ];

        let shouldExplode = false;
        let explodeX = x, explodeY = y, explodeZ = z;

        if (placedBlockId === REDSTONE_BLOCK_ID) {
            
            for (let offset of neighbors) {
                const nx = x + offset.x;
                const ny = y + offset.y;
                const nz = z + offset.z;
                
                const neighborId = world.getVoxel ? world.getVoxel(nx, ny, nz) : (world.getBlock ? world.getBlock(nx, ny, nz) : 0);
                
                if (neighborId === TNT_ID) {
                    shouldExplode = true;
                    
                    
                    explodeX = nx; explodeY = ny; explodeZ = nz;
                    break;
                }
            }
        } else if (placedBlockId === TNT_ID) {
            
            for (let offset of neighbors) {
                const nx = x + offset.x;
                const ny = y + offset.y;
                const nz = z + offset.z;
                const neighborId = world.getVoxel ? world.getVoxel(nx, ny, nz) : (world.getBlock ? world.getBlock(nx, ny, nz) : 0);
                
                if (neighborId === REDSTONE_BLOCK_ID) {
                    shouldExplode = true;
                    
                    explodeX = x; explodeY = y; explodeZ = z;
                    break;
                }
            }
        }

        if (shouldExplode) {
            console.log(`[RedstoneFix] Ignition detected at ${explodeX}, ${explodeY}, ${explodeZ}!`);
            
            
            
            setTimeout(() => {
                if (typeof world.explode === 'function') {
                    
                    
                    world.explode(explodeX, explodeY, explodeZ, 4); 
                } else {
                    
                    console.log("[RedstoneFix] Native explode not found. Manually clearing blocks.");
                    
                    if (world.setVoxel) world.setVoxel(explodeX, explodeY, explodeZ, 0);
                    
                    
                    
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dz = -2; dz <= 2; dz++) {
                                if (dx*dx + dy*dy + dz*dz <= 4) {
                                    if (world.setVoxel) world.setVoxel(explodeX+dx, explodeY+dy, explodeZ+dz, 0);
                                }
                            }
                        }
                    }
                }
            }, 3000); 
            
            
            
        }
    }

    
    init();

})();
