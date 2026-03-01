#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define GBUFFER_LINE
#define NO_SHADOWS

#include "/common/line_blocks_fragment.glsl"
