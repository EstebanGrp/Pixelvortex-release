#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define GBUFFER_CLOUDS
#define NO_SHADOWS
#define SPECIAL_TRANS

#include "/common/clouds_blocks_fragment.glsl"