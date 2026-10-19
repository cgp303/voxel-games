/**
 * True while the renderer is drawing the bloom buffer. Meshes whose glow differs from how they look on screen
 * (voxel text) read it in onBeforeRender to draw themselves differently in that pass.
 */
export const bloomPass = { active: false };
