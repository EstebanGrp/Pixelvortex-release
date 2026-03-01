#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define DEFERRED_SHADER
#define NO_SHADOWS

#include "/common/deferred_fragment.glsl"
