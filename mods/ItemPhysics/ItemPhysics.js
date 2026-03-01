(function() {
    'use strict';

    
    
    
    
    const state = {
        items: new Set(),
        rafId: null,
        isRunning: false,
        lastTime: 0
    };

    const PHYSICS = {
        GRAVITY: 20,              
        AIR_RESISTANCE: 0.98,     
        GROUND_FRICTION: 0.88,    
        BOUNCE_DAMPING: 0.4,      
        ANGULAR_DAMPING: 0.95,    
        MIN_VELOCITY: 0.02,       
        MIN_ANGULAR_VELOCITY: 0.02,
        GROUND_Y: 0,              
        ITEM_SIZE: 0.25,          
        MAX_SPEED: 20,            
        COLLISION_DISTANCE: 0.5   
    };

    
    
    
    
    class ItemPhysics {
        constructor(mesh, options = {}) {
            this.mesh = mesh;
            this.size = options.size || PHYSICS.ITEM_SIZE;
            
            
            this.velocity = {
                x: (Math.random() - 0.5) * 2,
                y: options.throwForce || 4,
                z: (Math.random() - 0.5) * 2
            };
            
            
            this.angularVelocity = {
                x: (Math.random() - 0.5) * 5,
                y: (Math.random() - 0.5) * 5,
                z: (Math.random() - 0.5) * 5
            };
            
            
            this.isGrounded = false;
            this.isSleeping = false;
            this.sleepTimer = 0;
            this.bounceCount = 0;
            
            
            this.bounciness = options.bounciness || 0.3;
        }

        applyGravity(dt) {
            if (!this.isGrounded) {
                this.velocity.y -= PHYSICS.GRAVITY * dt;
            }
        }

        applyFriction() {
            this.velocity.x *= PHYSICS.AIR_RESISTANCE;
            this.velocity.z *= PHYSICS.AIR_RESISTANCE;
            
            if (this.isGrounded) {
                this.velocity.x *= PHYSICS.GROUND_FRICTION;
                this.velocity.z *= PHYSICS.GROUND_FRICTION;
            }
            
            this.angularVelocity.x *= PHYSICS.ANGULAR_DAMPING;
            this.angularVelocity.y *= PHYSICS.ANGULAR_DAMPING;
            this.angularVelocity.z *= PHYSICS.ANGULAR_DAMPING;
        }

        checkGroundCollision() {
            const groundLevel = PHYSICS.GROUND_Y + this.size;
            
            if (this.mesh.position.y <= groundLevel) {
                this.mesh.position.y = groundLevel;
                
                if (Math.abs(this.velocity.y) > PHYSICS.MIN_VELOCITY) {
                    
                    this.velocity.y = -this.velocity.y * this.bounciness * PHYSICS.BOUNCE_DAMPING;
                    this.bounceCount++;
                    
                    
                    const impact = Math.abs(this.velocity.y);
                    this.angularVelocity.x += (Math.random() - 0.5) * impact;
                    this.angularVelocity.z += (Math.random() - 0.5) * impact;
                    
                    this.isGrounded = false;
                } else {
                    this.velocity.y = 0;
                    this.isGrounded = true;
                }
            } else {
                this.isGrounded = false;
            }
        }

        checkItemCollisions(others) {
            for (const other of others) {
                if (other === this || other.isSleeping) continue;

                const dx = this.mesh.position.x - other.mesh.position.x;
                const dy = this.mesh.position.y - other.mesh.position.y;
                const dz = this.mesh.position.z - other.mesh.position.z;
                
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const minDist = PHYSICS.COLLISION_DISTANCE;

                if (dist < minDist && dist > 0.01) {
                    
                    const overlap = (minDist - dist) * 0.5;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;

                    this.mesh.position.x += nx * overlap;
                    this.mesh.position.y += ny * overlap;
                    this.mesh.position.z += nz * overlap;
                    
                    other.mesh.position.x -= nx * overlap;
                    other.mesh.position.y -= ny * overlap;
                    other.mesh.position.z -= nz * overlap;

                    
                    const bounce = 0.5;
                    const vx = this.velocity.x - other.velocity.x;
                    const vy = this.velocity.y - other.velocity.y;
                    const vz = this.velocity.z - other.velocity.z;
                    
                    const impulse = (vx * nx + vy * ny + vz * nz) * bounce;
                    
                    this.velocity.x -= impulse * nx;
                    this.velocity.y -= impulse * ny;
                    this.velocity.z -= impulse * nz;
                    
                    other.velocity.x += impulse * nx;
                    other.velocity.y += impulse * ny;
                    other.velocity.z += impulse * nz;
                    
                    
                    this.wake();
                    other.wake();
                }
            }
        }

        limitSpeed() {
            const speed = Math.sqrt(
                this.velocity.x ** 2 + 
                this.velocity.y ** 2 + 
                this.velocity.z ** 2
            );
            
            if (speed > PHYSICS.MAX_SPEED) {
                const factor = PHYSICS.MAX_SPEED / speed;
                this.velocity.x *= factor;
                this.velocity.y *= factor;
                this.velocity.z *= factor;
            }
        }

        checkSleep() {
            const totalVel = Math.sqrt(
                this.velocity.x ** 2 + 
                this.velocity.y ** 2 + 
                this.velocity.z ** 2
            );
            
            const totalAngVel = Math.sqrt(
                this.angularVelocity.x ** 2 +
                this.angularVelocity.y ** 2 +
                this.angularVelocity.z ** 2
            );

            if (this.isGrounded && 
                totalVel < PHYSICS.MIN_VELOCITY && 
                totalAngVel < PHYSICS.MIN_ANGULAR_VELOCITY) {
                this.sleepTimer++;
                
                if (this.sleepTimer > 30) { 
                    this.isSleeping = true;
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.velocity.z = 0;
                    this.angularVelocity.x = 0;
                    this.angularVelocity.y = 0;
                    this.angularVelocity.z = 0;
                }
            } else {
                this.sleepTimer = 0;
            }
        }

        wake() {
            this.isSleeping = false;
            this.sleepTimer = 0;
        }

        update(dt, allItems) {
            if (this.isSleeping) return;

            
            this.applyGravity(dt);
            this.applyFriction();
            this.limitSpeed();

            
            this.mesh.position.x += this.velocity.x * dt;
            this.mesh.position.y += this.velocity.y * dt;
            this.mesh.position.z += this.velocity.z * dt;

            
            this.mesh.rotation.x += this.angularVelocity.x * dt;
            this.mesh.rotation.y += this.angularVelocity.y * dt;
            this.mesh.rotation.z += this.angularVelocity.z * dt;

            
            this.checkGroundCollision();
            this.checkItemCollisions(allItems);
            this.checkSleep();
        }

        
        addForce(fx, fy, fz) {
            this.velocity.x += fx;
            this.velocity.y += fy;
            this.velocity.z += fz;
            this.wake();
        }

        setVelocity(vx, vy, vz) {
            this.velocity.x = vx;
            this.velocity.y = vy;
            this.velocity.z = vz;
            this.wake();
        }
    }

    
    
    
    
    function physicsLoop(currentTime) {
        if (state.items.size === 0) {
            stopPhysics();
            return;
        }

        const dt = state.lastTime 
            ? Math.min((currentTime - state.lastTime) * 0.001, 0.05) 
            : 0.016;
        state.lastTime = currentTime;

        const itemsArray = Array.from(state.items);
        
        for (const item of itemsArray) {
            
            if (!item.mesh?.parent) {
                state.items.delete(item);
                continue;
            }
            
            item.update(dt, itemsArray);
        }

        state.rafId = requestAnimationFrame(physicsLoop);
    }

    function startPhysics() {
        if (!state.isRunning && state.items.size > 0) {
            state.isRunning = true;
            state.lastTime = 0;
            state.rafId = requestAnimationFrame(physicsLoop);
        }
    }

    function stopPhysics() {
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }
        state.isRunning = false;
        state.lastTime = 0;
    }

    
    
    
    
    function addItem(mesh, options = {}) {
        if (!mesh?.isObject3D) {
            console.warn('ItemPhysics: mesh inválido');
            return null;
        }

        const physics = new ItemPhysics(mesh, options);
        state.items.add(physics);
        startPhysics();
        
        return physics;
    }

    function removeItem(mesh) {
        for (const item of state.items) {
            if (item.mesh === mesh) {
                state.items.delete(item);
                return true;
            }
        }
        return false;
    }

    function throwItem(mesh, dirX, dirY, dirZ, force = 5) {
        for (const item of state.items) {
            if (item.mesh === mesh) {
                item.setVelocity(dirX * force, dirY * force, dirZ * force);
                return true;
            }
        }
        return false;
    }

    function collectItem(mesh, targetX, targetY, targetZ, speed = 10) {
        for (const item of state.items) {
            if (item.mesh === mesh) {
                const dx = targetX - mesh.position.x;
                const dy = targetY - mesh.position.y;
                const dz = targetZ - mesh.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (dist > 0.1) {
                    item.setVelocity(
                        (dx / dist) * speed,
                        (dy / dist) * speed,
                        (dz / dist) * speed
                    );
                }
                return true;
            }
        }
        return false;
    }

    function setGravity(value) {
        PHYSICS.GRAVITY = value;
    }

    function setGroundLevel(y) {
        PHYSICS.GROUND_Y = y;
    }

    function wakeAllItems() {
        state.items.forEach(item => item.wake());
    }

    function clearAllItems() {
        state.items.clear();
        stopPhysics();
    }

    function getStats() {
        let sleeping = 0;
        let grounded = 0;
        
        for (const item of state.items) {
            if (item.isSleeping) sleeping++;
            if (item.isGrounded) grounded++;
        }

        return {
            total: state.items.size,
            active: state.items.size - sleeping,
            sleeping,
            grounded,
            running: state.isRunning
        };
    }

    
    
    
    
    function init() {
        if (typeof scene === 'undefined') return;

        try {
            scene.traverse((obj) => {
                if (obj.userData?.isItem || obj.name?.includes('item')) {
                    addItem(obj);
                }
            });
        } catch (err) {
            console.error('Error al inicializar items:', err);
        }
    }

    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }

    
    window.ItemPhysics = {
        
        add: addItem,
        remove: removeItem,
        clear: clearAllItems,
        
        
        start: startPhysics,
        stop: stopPhysics,
        wakeAll: wakeAllItems,
        
        
        throw: throwItem,
        collect: collectItem,
        
        
        setGravity,
        setGroundLevel,
        
        
        getStats,
        getCount: () => state.items.size,
        
        
        config: PHYSICS
    };

    
    window.applyItemPhysics = addItem;

    console.log('✓ Sistema de físicas de items inicializado');

})();