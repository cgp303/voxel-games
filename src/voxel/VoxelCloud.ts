import type { IParsedVoxModel, IVoxelCloud } from '../config/interfaces/interfaces';

/**
 * Flattens a parsed .vox model into per-voxel positions and colours for effects (debris, etc.).
 * Positions are relative to the model's bounding-box centre, which is the origin VoxelGeometry centres
 * the instanced mesh on, so a particle placed at (position + offset) lines up with the intact model.
 * Colours match the mesh's vertex colours (palette entry / 255, palette index wrapping like the mesh).
 */
export function buildVoxelCloud(model: IParsedVoxModel): IVoxelCloud {
    const voxels = model.voxels;
    const count = voxels.length;
    if (count === 0) throw new Error('buildVoxelCloud: model has no voxels');

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const v of voxels) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
    }
    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;
    const centerZ = (minZ + maxZ + 1) / 2;

    const palette = model.colors;
    const paletteSize = Math.max(palette.length, 1);

    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const z = new Float32Array(count);
    const r = new Float32Array(count);
    const g = new Float32Array(count);
    const b = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const v = voxels[i];
        x[i] = v.x + 0.5 - centerX;
        y[i] = v.y + 0.5 - centerY;
        z[i] = v.z + 0.5 - centerZ;

        const color = palette[v.colorIndex % paletteSize];
        r[i] = (color?.r || 0) / 255;
        g[i] = (color?.g || 0) / 255;
        b[i] = (color?.b || 0) / 255;
    }
    return { count, x, y, z, r, g, b };
}
