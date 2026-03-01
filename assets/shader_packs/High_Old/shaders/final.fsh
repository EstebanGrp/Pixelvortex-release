varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float viewWidth;
uniform float viewHeight;
uniform float uCaveFactor; 


#define SATURATION 1.3
#define CONTRAST 1.05
#define BLOOM_STRENGTH 0.4
#define EXPOSURE 1.1


vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

void main() {
    vec2 texel = vec2(1.0/viewWidth, 1.0/viewHeight);
    vec4 tex = texture2D(tDiffuse, vUv);
    vec3 color = tex.rgb;

    
    vec3 blur = vec3(0.0);
    blur += texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * texel * 3.0).rgb;
    blur += texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * texel * 3.0).rgb;
    blur += texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * texel * 3.0).rgb;
    blur += texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel * 3.0).rgb;
    blur *= 0.25;
    
    
    vec3 bloomColor = max(blur - 0.5, 0.0) * BLOOM_STRENGTH;
    color += bloomColor;

    
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 shadowColor = vec3(0.7, 0.85, 1.0); 
    vec3 highlightColor = vec3(1.0, 0.9, 0.75); 
    
    
    vec3 graded = mix(shadowColor * lum, highlightColor * lum, smoothstep(0.0, 1.0, lum));
    color = mix(color, graded, 0.25); 

    
    vec3 gray = vec3(lum);
    color = mix(gray, color, SATURATION);

    
    color = (color - 0.5) * CONTRAST + 0.5;
    
    
    color *= EXPOSURE;

    
    color = ACESFilm(color);

    
    vec2 uv = vUv * (1.0 - vUv.yx);
    float vig = uv.x * uv.y * 15.0;
    vig = pow(vig, 0.1);
    color *= vig;

    
    if (uCaveFactor > 0.0) {
        float darkness = uCaveFactor * 0.95; 
        color *= (1.0 - darkness);
        
        color = mix(color, vec3(0.0, 0.0, 0.1), uCaveFactor * 0.3);
    }

    gl_FragColor = vec4(color, tex.a);
}
