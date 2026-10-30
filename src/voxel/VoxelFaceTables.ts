/**
 * Face tables shared by the voxel meshers (VoxelGeometry and GreedyMesher).
 * Kept free of three.js so the meshers can be unit-tested under Node.
 */
import type { VoxelColorPalette } from '../config/types/types.ts';

export const FACE_DIRECTIONS = 6;

// Face order matches the exposure bits: +X, -X, +Y, -Y, +Z, -Z.
// Four corners per face (winding gives outward-facing triangles), three numbers per corner.
// Every corner's coordinate along the face's own axis is 1 for a + face and 0 for a - face.
export const FACE_CORNERS = new Int8Array([
    1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, // +X
    0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, // -X
    0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, // +Y
    0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, // -Y
    0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, // +Z
    1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, // -Z
]);

// Normals as implied by each face's triangle winding, i.e. exactly what
// computeVertexNormals() produces. The Y and Z quads are wound clockwise, so these point
// inward; the DoubleSide material flips them for back faces, which keeps lighting correct.
// Do not "fix" the signs without also fixing the winding above, or lighting will invert.
export const FACE_NORMALS = new Int8Array([
    1, 0, 0,
    -1, 0, 0,
    0, -1, 0,
    0, 1, 0,
    0, 0, -1,
    0, 0, 1,
]);

/** Exposure bit for the -Y (bottom) face. */
export const BOTTOM_FACE_BIT = 1 << 3;

/** Palette flattened to normalised r,g,b triples; an empty palette yields a single black entry. */
export function buildColorTable(palette: VoxelColorPalette): Float32Array {
    const entries = Math.max(palette.length, 1);
    const table = new Float32Array(entries * 3);
    for (let i = 0; i < palette.length; i++) {
        const color = palette[i];
        table[i * 3] = (color?.r || 0) / 255;
        table[i * 3 + 1] = (color?.g || 0) / 255;
        table[i * 3 + 2] = (color?.b || 0) / 255;
    }
    return table;
}
