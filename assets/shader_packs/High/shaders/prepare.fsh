#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif

#define PREPARE_SHADER
#define NO_SHADOWS
#define SET_FOG_COLOR

#include "/common/prepare_fragment.glsl"