(function() {
    // Definir MBX_STORAGE globalmente para evitar conflictos con chrome.storage
    window.MBX_STORAGE = {};

    // Event listener system for onChanged
    const listeners = new Set();
    window.MBX_STORAGE.onChanged = {
        addListener: (cb) => listeners.add(cb),
        removeListener: (cb) => listeners.delete(cb),
        hasListener: (cb) => listeners.has(cb)
    };

    window.MBX_STORAGE.local = {
        get: (keys, callback) => {
            const result = {};
            const getVal = (key) => {
                const val = localStorage.getItem(key);
                try {
                    return val ? JSON.parse(val) : undefined;
                } catch (e) {
                    return val;
                }
            };

            if (Array.isArray(keys)) {
                keys.forEach(key => {
                    const val = getVal(key);
                    if (val !== undefined) result[key] = val;
                });
            } else if (typeof keys === 'string') {
                const val = getVal(keys);
                if (val !== undefined) result[keys] = val;
            } else if (typeof keys === 'object' && keys !== null) {
                for (const key in keys) {
                    const val = getVal(key);
                    result[key] = val !== undefined ? val : keys[key];
                }
            } else if (keys === null) {
                 // get all
                 for (let i = 0; i < localStorage.length; i++) {
                     const key = localStorage.key(i);
                     result[key] = getVal(key);
                 }
            }

            if (callback) setTimeout(() => callback(result), 0);
            return Promise.resolve(result);
        },
        set: (items, callback) => {
            const changes = {};
            for (const key in items) {
                const oldValStr = localStorage.getItem(key);
                let oldVal;
                try { oldVal = oldValStr ? JSON.parse(oldValStr) : undefined; } catch(e) { oldVal = oldValStr; }
                
                const newVal = items[key];
                localStorage.setItem(key, JSON.stringify(newVal));

                changes[key] = {
                    oldValue: oldVal,
                    newValue: newVal
                };
            }

            // Notify listeners
            listeners.forEach(cb => {
                try { cb(changes, 'local'); } catch(e) { console.error(e); }
            });

            if (callback) setTimeout(() => callback(), 0);
            return Promise.resolve();
        },
        remove: (keys, callback) => {
             const changes = {};
             const keysArr = Array.isArray(keys) ? keys : [keys];
             
             keysArr.forEach(key => {
                 const oldValStr = localStorage.getItem(key);
                 let oldVal;
                 try { oldVal = oldValStr ? JSON.parse(oldValStr) : undefined; } catch(e) { oldVal = oldValStr; }

                 localStorage.removeItem(key);
                 changes[key] = {
                    oldValue: oldVal,
                    newValue: undefined
                 };
             });

             listeners.forEach(cb => {
                try { cb(changes, 'local'); } catch(e) { console.error(e); }
            });

             if (callback) setTimeout(() => callback(), 0);
             return Promise.resolve();
        }
    };
    
    console.log("[MBX_STORAGE] Initialized isolated storage system.");
})();
