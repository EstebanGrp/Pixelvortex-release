#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define GBUFFER_ARMOR_GLINT
#define SHADER_BASIC

#include "/common/glint_blocks_fragment.glsl"
