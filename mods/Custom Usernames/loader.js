(function() {
    // Loader para Custom Usernames Mod
    // Carga las dependencias en orden secuencial para asegurar que el polyfill y la UI estén listos antes de la lógica principal.

    const basePath = "mods/Custom Usernames/";
    const scripts = [
        "mbx_storage.js",     // 1. Almacenamiento aislado (MBX_STORAGE)
        "save.js",            // 2. Helper de guardado de drafts
        "animations.js",      // 3. Banner de bienvenida y animaciones
        "popup_injector.js",  // 4. UI de configuración
        "CustomUsernames.js"  // 5. Lógica principal del mod (reemplazo de nombres y PFP)
    ];

    function loadNext(index) {
        if (index >= scripts.length) {
            console.log("[CustomUsernames] Todos los scripts cargados correctamente.");
            return;
        }
        
        const scriptName = scripts[index];
        const s = document.createElement("script");
        s.src = basePath + scriptName;
        
        s.onload = () => {
            console.log(`[CustomUsernames] Cargado: ${scriptName}`);
            loadNext(index + 1);
        };
        
        s.onerror = (e) => {
            console.error(`[CustomUsernames] Error cargando: ${scriptName}`, e);
            // Intentar seguir con el siguiente por si acaso
            loadNext(index + 1);
        };
        
        document.head.appendChild(s);
    }

    console.log("[CustomUsernames] Iniciando secuencia de carga...");
    loadNext(0);
})();
