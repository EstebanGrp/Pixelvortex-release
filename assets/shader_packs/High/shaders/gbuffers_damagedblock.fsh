#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define NO_SHADOWS
#define GBUFFER_DAMAGE

#include "/common/damage_fragment.glsl"