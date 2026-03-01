#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define GBUFFER_SPIDEREYES
#define NO_SHADOWS

#include "/common/spidereyes_blocks_fragment.glsl"
