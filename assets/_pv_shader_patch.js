
class PVShaderPatch {
// ========== [PV-Mod] GLSL Preprocessor for OptiFine-style shader packs ==========
    static async _pvFetchText(url) {
    try {
        const r = await fetch(url);
        if (r.ok) return await r.text();
    } catch (_) { }
    return null;
}
    static async _pvResolveIncludes(baseDir, source, depth = 0, seen = new Set()) {
    if (depth > 40) return source;
    const lines = source.split('\n');
    let out = '';
    for (const line of lines) {
        const m = line.match(/^\s*#include\s+"(.+)"/);
        if (m) {
            let incPath = m[1];
            let fullUrl;
            if (incPath.startsWith('/')) {
                fullUrl = baseDir + incPath.substring(1);
            } else {
                const lastSlash = baseDir.lastIndexOf('/');
                const dir = lastSlash >= 0 ? baseDir.substring(0, lastSlash + 1) : baseDir;
                fullUrl = dir + incPath;
            }
            const key = fullUrl.toLowerCase();
            if (seen.has(key)) {
                out += '// [PV] skipped circular include: ' + incPath + '\n';
                continue;
            }
            seen.add(key);
            const incSrc = await this._pvFetchText(fullUrl);
            if (incSrc != null) {
                console.log('[ShaderSystem] Resolved #include "' + incPath + '"');
                const resolved = await this._pvResolveIncludes(baseDir, incSrc, depth + 1, seen);
                out += resolved + '\n';
            } else {
                console.warn('[ShaderSystem] #include not found: ' + fullUrl);
                out += '// [PV] missing include: ' + incPath + '\n';
            }
        } else {
            out += line + '\n';
        }
    }
    return out;
}
    static _pvPreprocess(source, extraDefines = {}) {
    const defines = Object.assign({}, extraDefines);
    const lines = source.split('\n');
    const out = [];
    const stack = [];
    function isActive() {
        for (let i = 0; i < stack.length; i++) {
            if (!stack[i].active) return false;
        }
        return true;
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const defM = trimmed.match(/^#define\s+(\w+)(?:\s+(.*))?$/);
        if (defM && isActive()) {
            defines[defM[1]] = defM[2] !== undefined ? defM[2] : '1';
            continue;
        }
        const undefM = trimmed.match(/^#undef\s+(\w+)/);
        if (undefM && isActive()) {
            delete defines[undefM[1]];
            continue;
        }
        const ifdefM = trimmed.match(/^#ifdef\s+(\w+)/);
        if (ifdefM) {
            const pActive = stack.length === 0 || stack.every(s => s.active);
            const active = pActive && (ifdefM[1] in defines);
            stack.push({ active: active, wasActive: active, parentActive: pActive });
            continue;
        }
        const ifndefM = trimmed.match(/^#ifndef\s+(\w+)/);
        if (ifndefM) {
            const pActive = stack.length === 0 || stack.every(s => s.active);
            const active = pActive && !(ifndefM[1] in defines);
            stack.push({ active: active, wasActive: active, parentActive: pActive });
            continue;
        }
        const ifM = trimmed.match(/^#if\s+(.+)$/);
        if (ifM && !trimmed.startsWith('#ifdef') && !trimmed.startsWith('#ifndef')) {
            let expr = ifM[1];
            expr = expr.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) => n in defines ? '1' : '0');
            for (const k in defines) {
                expr = expr.replace(new RegExp('\\b' + k + '\\b', 'g'), defines[k]);
            }
            let val = false;
            try { val = !!Function('"use strict"; return (' + expr.replace(/[^0-9+\-*/%<>=!&|~() \t]/g, '0') + ')')(); } catch (_) { }
            const pActive = stack.length === 0 || stack.every(s => s.active);
            stack.push({ active: pActive && val, wasActive: pActive && val, parentActive: pActive });
            continue;
        }
        const elifM = trimmed.match(/^#elif\s+(.+)$/);
        if (elifM && stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top.wasActive) { top.active = false; }
            else {
                let expr = elifM[1];
                expr = expr.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) => n in defines ? '1' : '0');
                for (const k in defines) { expr = expr.replace(new RegExp('\\b' + k + '\\b', 'g'), defines[k]); }
                let val = false;
                try { val = !!Function('"use strict"; return (' + expr.replace(/[^0-9+\-*/%<>=!&|~() \t]/g, '0') + ')')(); } catch (_) { }
                top.active = top.parentActive && val;
                if (top.active) top.wasActive = true;
            }
            continue;
        }
        if (trimmed === '#else' && stack.length > 0) {
            const top = stack[stack.length - 1];
            top.active = top.parentActive && !top.wasActive;
            if (top.active) top.wasActive = true;
            continue;
        }
        if (trimmed === '#endif' && stack.length > 0) { stack.pop(); continue; }
        if (trimmed.match(/^#version\s/)) continue;
        if (trimmed.match(/^#extension\s/)) continue;
        if (isActive()) { out.push(line); }
    }
    return out.join('\n');
}
    static _pvWebGLCompat(src) {
    let s = src.replace(/gl_FragData\s*\[\s*0\s*\]/g, 'gl_FragColor');
    s = s.replace(/(\d+\.\d+)f\b/g, '$1');
    s = s.replace(/\btexture\s*\(\s*/g, 'texture2D(');
    s = s.replace(/texture2D\(composite\s*,/g, 'texture2D(tDiffuse,');
    s = s.replace(/texture2D\(colortex0\s*,/g, 'texture2D(tDiffuse,');
    s = s.replace(/texture2D\(colortex1\s*,/g, 'texture2D(tDiffuse,');
    if (!s.includes('precision ')) { s = 'precision highp float;\n' + s; }
    if (!s.includes('varying vec2 vUv') && !s.includes('varying vec2 texcoord')) { s = 'varying vec2 vUv;\n' + s; }
    return s;
}
    static async _pvLoadAndProcessShader(baseDir, fileName, extraDefines = {}) {
    const raw = await this._pvFetchText(baseDir + fileName);
    if (raw == null) return null;
    console.log('[ShaderSystem] Loaded ' + fileName + ' from ' + baseDir);
    const resolved = await this._pvResolveIncludes(baseDir, raw, 0, new Set());
    const processed = this._pvPreprocess(resolved, extraDefines);
    return this._pvWebGLCompat(processed);
}
    // ========== End GLSL Preprocessor ==========

    static async applyShaderPack(name) {
    try {
        if (!name || name === "Off") {
            if (this.shaderPackPass) { this.composer.removePass(this.shaderPackPass); this.shaderPackPass = null }
            if (this.compositePass) { this.composer.removePass(this.compositePass); this.compositePass = null }
            this.colorPass.renderToScreen = !0;
            return
        }
        if (Options$1.shaderShadows) {
            Options$1.shaderShadows.value = true;
            if (this.game && this.game.gameScene && this.game.gameScene.sun && this.game.gameScene.sun.sunlight) {
                this.game.gameScene.sun.sunlight.castShadow = true;
            }
        }

        // [PV-Mod] Try root shader_packs/ first, then fallback to assets/shader_packs/
        let base = null;
        let usePreprocessor = false;
        const rootBase = `shader_packs/${name}/shaders/`;
        const assetsBase = `assets/shader_packs/${name}/shaders/`;
        const rootDirectBase = `shader_packs/shaders/`;

        let testResp = await this._pvFetchText(rootBase + "final.fsh");
        if (testResp != null) {
            base = rootBase;
            usePreprocessor = testResp.includes('#include');
            console.log("[ShaderSystem] Found shader pack at root: " + rootBase);
        } else {
            testResp = await this._pvFetchText(rootDirectBase + "final.fsh");
            if (testResp != null) {
                base = rootDirectBase;
                usePreprocessor = testResp.includes('#include');
                console.log("[ShaderSystem] Found shader pack at root direct: " + rootDirectBase);
            } else {
                base = assetsBase;
                console.log("[ShaderSystem] Using assets shader pack: " + assetsBase);
            }
        }

        console.log("[ShaderSystem] Loading shader pack from:", base, "preprocessor:", usePreprocessor);
        const vs = `\n            varying vec2 vUv;\n            varying vec4 texcoord;\n            varying vec3 sunlight;\n            void main() {\n              vUv = uv;\n              texcoord = vec4(uv, 0.0, 1.0);\n              sunlight = vec3(1.0);\n              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n            }\n          `;

        const defaultDefines = {
            'USE_BASIC_SH': '1', 'UNKNOWN_DIM': '1', 'SHADOWS': '1', 'REAL_SHADOWS': '1',
            'MC_VERSION': '11605', 'MC_GL_VERSION': '300', 'MC_GLSL_VERSION': '300', 'MC_OS_WINDOWS': '1'
        };

        let compositeSrc = null;
        try {
            console.log("[ShaderSystem] Fetching composite.fsh...");
            if (usePreprocessor) {
                compositeSrc = await this._pvLoadAndProcessShader(base, "composite.fsh", Object.assign({}, defaultDefines, { 'COMPOSITE_SHADER': '1' }));
            } else {
                const r = await fetch(base + "composite.fsh");
                if (r.ok) compositeSrc = await r.text();
            }
            if (compositeSrc) console.log("[ShaderSystem] composite.fsh loaded.");
            else console.log("[ShaderSystem] composite.fsh not found (optional).");
        } catch (e) { console.error("[ShaderSystem] Error fetching composite.fsh:", e); }

        if (this.compositePass) { this.composer.removePass(this.compositePass); this.compositePass = null }
        if (compositeSrc) {
            try {
                if (!usePreprocessor) {
                    compositeSrc = compositeSrc.replace(/^#version.*$/m, "").replace(/(\d+\.\d+)f\b/g, "$1").replace(/texture2D\(composite,/g, "texture2D(tDiffuse,");
                    compositeSrc = `precision mediump float;\n` + compositeSrc;
                }
                this.compositePass = new ShaderPass({
                    uniforms: { tDiffuse: { value: null } },
                    vertexShader: vs,
                    fragmentShader: compositeSrc
                });
                console.log("[ShaderSystem] Composite pass created.");
            } catch (e) { console.error("[ShaderSystem] Error creating composite pass:", e); }
        }

        console.log("[ShaderSystem] Fetching final.fsh...");
        let finalProcessed = null;
        if (usePreprocessor) {
            finalProcessed = await this._pvLoadAndProcessShader(base, "final.fsh", Object.assign({}, defaultDefines, { 'FINAL_SHADER': '1' }));
            if (!finalProcessed) throw new Error("final.fsh preprocessing failed for shader pack " + name);
        } else {
            const finalResp = await fetch(base + "final.fsh");
            if (!finalResp.ok) throw new Error("final.fsh not found for shader pack " + name);
            const finalSrc = await finalResp.text();
            finalProcessed = finalSrc.replace(/^#version.*$/m, "").replace(/(\d+\.\d+)f\b/g, "$1").replace(/texture2D\(composite,/g, "texture2D(tDiffuse,");
            finalProcessed = `precision mediump float;\n` + finalProcessed;
        }
        console.log("[ShaderSystem] final.fsh loaded and processed.");

        if (this.shaderPackPass) { this.composer.removePass(this.shaderPackPass) }
        const black = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
        black.needsUpdate = !0;
        const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
        white.needsUpdate = !0;
        const cam = this.game.gameScene.camera;
        const projInv = new Matrix4().copy(cam.projectionMatrix).invert();
        const shadowTex = this.shadowRenderTarget ? this.shadowRenderTarget.texture : black;
        const shadowDepth = this.shadowRenderTarget && this.shadowRenderTarget.depthTexture ? this.shadowRenderTarget.depthTexture : black;
        const shadowMat = new Matrix4();
        if (this.shadowCamera) { shadowMat.multiplyMatrices(this.shadowCamera.projectionMatrix, this.shadowCamera.matrixWorldInverse); }

        this.shaderPackPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                depthtex0: { value: this.composer.readBuffer.depthTexture || black },
                shadowtex0: { value: shadowDepth },
                shadowtex1: { value: shadowTex },
                shadowcolor0: { value: shadowTex },
                shadowModelView: { value: this.shadowCamera ? this.shadowCamera.matrixWorldInverse : new Matrix4() },
                shadowProjection: { value: this.shadowCamera ? this.shadowCamera.projectionMatrix : new Matrix4() },
                gnormal: { value: black },
                gaux2: { value: black },
                gaux3: { value: black },
                colortex1: { value: null },
                colortex3: { value: black },
                noisetex: { value: black },
                gbufferProjection: { value: cam.projectionMatrix },
                gbufferProjectionInverse: { value: projInv },
                cameraPosition: { value: cam.position },
                sunPosition: { value: this.game.gameScene.sun.sunlight.position },
                worldTime: { value: 0 },
                uCaveFactor: { value: 0.0 },
                uTime: { value: 0.0 },
                uResolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
                near: { value: cam.near },
                far: { value: cam.far },
                viewWidth: { value: window.innerWidth },
                viewHeight: { value: window.innerHeight },
                pixel_size_x: { value: 1.0 / window.innerWidth },
                pixel_size_y: { value: 1.0 / window.innerHeight }
            },
            vertexShader: vs,
            fragmentShader: finalProcessed
        });
        this.colorPass.renderToScreen = !1;
        if (this.compositePass) { this.compositePass.renderToScreen = !1; this.composer.addPass(this.compositePass) }
        this.shaderPackPass.renderToScreen = !0;
        this.composer.addPass(this.shaderPackPass)
    } catch (e) {
        console.error(e);
        if (this.shaderPackPass) { this.composer.removePass(this.shaderPackPass); this.shaderPackPass = null }
        if (this.compositePass) { this.composer.removePass(this.compositePass); this.compositePass = null }
        this.colorPass.renderToScreen = !0
    }
}
}
window.PVShaderPatch = PVShaderPatch;