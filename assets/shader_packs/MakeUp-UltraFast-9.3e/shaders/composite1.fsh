#version 120


#define USE_BASIC_SH 

#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define COMPOSITE1_SHADER

#include "/common/composite1_fragment.glsl"