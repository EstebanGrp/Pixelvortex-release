#version 120


#ifdef USE_BASIC_SH
    #define UNKNOWN_DIM
#endif
#define GBUFFER_ENTITIES
#define GBUFFER_ENTITY_GLOW

#include "/common/solid_blocks_fragment.glsl"

