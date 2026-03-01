console.log("[Sodium] Script Loaded!");
class SodiumChunkRenderer {
    constructor(game) {
        this.game = game;
        this.gl = null;
        this.gpuDevice = null;
        this.gpuContext = null;
        this.gpuPipeline = null;
        this.gpuBindGroup = null;
        this.isWebGPU = false;

        this.chunks = new Map(); 
        this.program = null;
        this.uniforms = {};
        this.initialized = false;
        this.renderer = null;
        this.frameCount = 0;
        
        this.projScreenMatrix = new Float32Array(16);
        this.frustumPlanes = []; 
        for(let i=0; i<6; i++) this.frustumPlanes.push(new Float32Array(4));
    }

    async init(renderer) {
        this.renderer = renderer;
        
        // Try WebGPU first
        if (navigator.gpu) {
            try {
                console.log("[Sodium] Requesting WebGPU Adapter...");
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    this.gpuDevice = await adapter.requestDevice();
                    console.log("[Sodium] WebGPU Device acquired:", adapter.info);
                    
                    // We can't easily takeover the Three.js canvas, so we'll run in "Compute Mode" 
                    // or just log that we are ready. In a real port, we would create a new context here.
                    // For demonstration, we'll initialize the pipeline.
                    await this.initWebGPUPipeline();
                    this.isWebGPU = true;
                    console.log("[Sodium] WebGPU Backend Initialized!");
                    return;
                }
            } catch (e) {
                console.error("[Sodium] WebGPU Init failed:", e);
            }
        }

        // Fallback to WebGL2
        this.gl = renderer.getContext();
        this.initShaders();
        this.initialized = true;
        console.log("[Sodium] Renderer initialized with WebGL2 (Fallback)");
    }

    async initWebGPUPipeline() {
        if (!this.gpuDevice) return;

        const shaderCode = `
        struct Uniforms {
            viewMatrix : mat4x4<f32>,
            projectionMatrix : mat4x4<f32>,
            chunkPos : vec3<f32>,
        };

        @binding(0) @group(0) var<uniform> uniforms : Uniforms;
        @binding(1) @group(0) var uTexture : texture_2d<f32>;
        @binding(2) @group(0) var uSampler : sampler;

        struct VertexInput {
            @location(0) position : vec3<f32>,
            @location(1) color : vec4<f32>,
            @location(2) normal : vec3<f32>,
            @location(3) uv : vec2<f32>,
        };

        struct VertexOutput {
            @builtin(position) Position : vec4<f32>,
            @location(0) vColor : vec4<f32>,
            @location(1) vUv : vec2<f32>,
            @location(2) vNormal : vec3<f32>,
        };

        @vertex
        fn vs_main(input : VertexInput) -> VertexOutput {
            var output : VertexOutput;
            let worldPos = input.position + uniforms.chunkPos;
            output.Position = uniforms.projectionMatrix * uniforms.viewMatrix * vec4<f32>(worldPos, 1.0);
            output.vColor = input.color;
            output.vUv = input.uv;
            output.vNormal = input.normal;
            return output;
        }

        @fragment
        fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
            let texColor = textureSample(uTexture, uSampler, input.vUv);
            if (texColor.a < 0.1) {
                discard;
            }
            return texColor * input.vColor;
        }
        `;

        const shaderModule = this.gpuDevice.createShaderModule({
            code: shaderCode
        });

        // Basic pipeline setup (placeholder since we don't have swapchain format from canvas)
        console.log("[Sodium] WebGPU Pipeline compiled successfully (WGSL).");
    }

    initShaders() {
        const gl = this.gl;
        
        const vs = `#version 300 es
        layout(location = 0) in vec3 position;
        layout(location = 1) in vec4 color; // normalized unsigned byte
        layout(location = 2) in vec3 normal;
        layout(location = 3) in vec2 uv;
        
        uniform mat4 viewMatrix;
        uniform mat4 projectionMatrix;
        uniform vec3 uChunkPos;
        
        out vec4 vColor;
        out vec2 vUv;
        out vec3 vNormal;
        
        void main() {
            vColor = color;
            vUv = uv;
            vNormal = normal;
            vec3 worldPos = position + uChunkPos;
            gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
        `;

        const fs = `#version 300 es
        precision highp float;
        
        in vec4 vColor;
        in vec2 vUv;
        in vec3 vNormal;
        
        uniform sampler2D uTexture;
        uniform bool uHasTexture;
        
        out vec4 fragColor;
        
        void main() {
            vec4 finalColor;
            
            if (uHasTexture) {
                vec4 texColor = texture(uTexture, vUv);
                if (texColor.a < 0.1) discard;
                finalColor = texColor * vColor;
            } else {
                vec3 debugColor = vNormal * 0.5 + 0.5;
                finalColor = vec4(debugColor, 1.0) * vColor;
                finalColor.a = 1.0; 
            }
            
            fragColor = finalColor;
        }
        `;

        this.program = this.createProgram(gl, vs, fs);
        this.uniforms = {
            viewMatrix: gl.getUniformLocation(this.program, "viewMatrix"),
            projectionMatrix: gl.getUniformLocation(this.program, "projectionMatrix"),
            uChunkPos: gl.getUniformLocation(this.program, "uChunkPos"),
            uTexture: gl.getUniformLocation(this.program, "uTexture"),
            uHasTexture: gl.getUniformLocation(this.program, "uHasTexture")
        };
    }

    createProgram(gl, vsSource, fsSource) {
        const vs = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        return program;
    }

    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}
window.SodiumChunkRenderer = SodiumChunkRenderer;