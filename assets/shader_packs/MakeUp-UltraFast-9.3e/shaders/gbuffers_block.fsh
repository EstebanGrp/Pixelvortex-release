#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define GBUFFER_BLOCK

#include "/common/solid_blocks_fragment.glsl"
