import type { ICollisionVoxel } from '../../src/systems/collision/CollisionModel.ts';

/** Solid w x h x d block of voxels starting at the origin; `skip` carves out voxels. */
export function box(
    w: number,
    h: number,
    d: number,
    skip?: (x: number, y: number, z: number) => boolean,
): ICollisionVoxel[] {
    const out: ICollisionVoxel[] = [];
    for (let z = 0; z < d; z++) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!skip?.(x, y, z)) out.push({ x, y, z });
            }
        }
    }
    return out;
}
