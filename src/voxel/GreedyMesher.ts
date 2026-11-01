import type { VoxelWorld } from './VoxelWorld.ts';
import type { IGreedyQuads, IVoxelMeshBuffers } from '../config/interfaces/interfaces.ts';
import type { VoxelColorPalette } from '../config/types/types.ts';
import { FACE_CORNERS, FACE_DIRECTIONS, FACE_NORMALS, buildColorTable } from './VoxelFaceTables.ts';

/** Ints stored per quad in IGreedyQuads.quads: direction, slice, u, v, width, height, cell. */
export const GREEDY_QUAD_STRIDE = 7;

/** The two in-slice axes (0 = x, 1 = y, 2 = z) for faces along `axis`: u then v. */
export function sliceAxes(axis: number): [number, number] {
    return [(axis + 1) % 3, (axis + 2) % 3];
}

/**
 * Greedy meshing: for each face direction, walk the world one slice at a time, mark the visible
 * faces in that slice by colour, then cover them with as few same-coloured rectangles as possible
 * (grow each rectangle along u first, then along v while the whole row still matches).
 *
 * Covers exactly the faces the per-voxel mesher in VoxelGeometry emits, with the same colours.
 */
export function greedyQuads(world: VoxelWorld, cullBottomFaces: boolean): IGreedyQuads {
    const { x: width, y: height, z: depth } = world.getDimensions();
    const cells = world.getCells();
    const dims = [width, height, depth];
    const strides = [1, width, width * height];

    const mask = new Int32Array(Math.max(width * height, height * depth, depth * width));
    let quads = new Int32Array(1024 * GREEDY_QUAD_STRIDE);
    let count = 0;

    for (let direction = 0; direction < FACE_DIRECTIONS; direction++) {
        const axis = direction >> 1;
        const positive = (direction & 1) === 0;
        const [uAxis, vAxis] = sliceAxes(axis);
        const dimA = dims[axis];
        const dimU = dims[uAxis];
        const dimV = dims[vAxis];
        const strideA = strides[axis];
        const strideU = strides[uAxis];
        const strideV = strides[vAxis];
        const lastSlice = dimA - 1;

        for (let slice = 0; slice < dimA; slice++) {
            // -Y faces of the bottom layer
            if (cullBottomFaces && direction === 3 && slice === 0) continue;

            // Build the mask: cell value where a face points into empty space, else 0.
            const atEdge = positive ? slice === lastSlice : slice === 0;
            const neighbourStep = positive ? strideA : -strideA;
            let any = false;
            for (let v = 0, m = 0; v < dimV; v++) {
                let index = slice * strideA + v * strideV;
                for (let u = 0; u < dimU; u++, m++, index += strideU) {
                    const cell = cells[index];
                    if (cell !== 0 && (atEdge || cells[index + neighbourStep] === 0)) {
                        mask[m] = cell;
                        any = true;
                    } else {
                        mask[m] = 0;
                    }
                }
            }
            if (!any) continue;

            // Cover the mask with rectangles.
            for (let v = 0; v < dimV; v++) {
                const row = v * dimU;
                for (let u = 0; u < dimU; ) {
                    const cell = mask[row + u];
                    if (cell === 0) {
                        u++;
                        continue;
                    }

                    let w = 1;
                    while (u + w < dimU && mask[row + u + w] === cell) w++;

                    let h = 1;
                    grow: while (v + h < dimV) {
                        const next = row + h * dimU + u;
                        for (let k = 0; k < w; k++) {
                            if (mask[next + k] !== cell) break grow;
                        }
                        h++;
                    }

                    for (let dv = 0; dv < h; dv++) {
                        mask.fill(0, row + dv * dimU + u, row + dv * dimU + u + w);
                    }

                    if ((count + 1) * GREEDY_QUAD_STRIDE > quads.length) {
                        const bigger = new Int32Array(quads.length * 2);
                        bigger.set(quads);
                        quads = bigger;
                    }
                    const at = count * GREEDY_QUAD_STRIDE;
                    quads[at] = direction;
                    quads[at + 1] = slice;
                    quads[at + 2] = u;
                    quads[at + 3] = v;
                    quads[at + 4] = w;
                    quads[at + 5] = h;
                    quads[at + 6] = cell;
                    count++;

                    u += w;
                }
            }
        }
    }

    return { quads, count };
}

/**
 * Mesh arrays for a VoxelWorld using greedy meshing.
 *
 * Each merged quad is the matching unit face from FACE_CORNERS stretched along its two in-slice
 * axes, so winding and normals are identical to the per-voxel mesher (including its deliberately
 * inward Y/Z normals; see FACE_NORMALS).
 */
export function greedyMesh(
    world: VoxelWorld,
    palette: VoxelColorPalette,
    cullBottomFaces: boolean,
    writeNormals: boolean,
): IVoxelMeshBuffers {
    const { quads, count } = greedyQuads(world, cullBottomFaces);

    const vertexCount = count * 4;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const normals = writeNormals ? new Float32Array(vertexCount * 3) : null;
    const indices = new Uint32Array(count * 6);

    const colorTable = buildColorTable(palette);
    const paletteSize = colorTable.length / 3;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    const point = [0, 0, 0];
    for (let q = 0; q < count; q++) {
        const at = q * GREEDY_QUAD_STRIDE;
        const direction = quads[at];
        const slice = quads[at + 1];
        const u0 = quads[at + 2];
        const v0 = quads[at + 3];
        const w = quads[at + 4];
        const h = quads[at + 5];
        const cell = quads[at + 6];

        const axis = direction >> 1;
        const [uAxis, vAxis] = sliceAxes(axis);

        const colorOffset = ((cell - 1) % paletteSize) * 3;
        const r = colorTable[colorOffset];
        const g = colorTable[colorOffset + 1];
        const b = colorTable[colorOffset + 2];

        const vertex = q * 4;
        const cornerBase = direction * 12;
        for (let corner = 0; corner < 4; corner++) {
            const c = cornerBase + corner * 3;
            point[axis] = slice + FACE_CORNERS[c + axis];
            point[uAxis] = u0 + FACE_CORNERS[c + uAxis] * w;
            point[vAxis] = v0 + FACE_CORNERS[c + vAxis] * h;
            const px = point[0];
            const py = point[1];
            const pz = point[2];
            const p = (vertex + corner) * 3;

            positions[p] = px;
            positions[p + 1] = py;
            positions[p + 2] = pz;
            colors[p] = r;
            colors[p + 1] = g;
            colors[p + 2] = b;

            if (normals) {
                normals[p] = FACE_NORMALS[direction * 3];
                normals[p + 1] = FACE_NORMALS[direction * 3 + 1];
                normals[p + 2] = FACE_NORMALS[direction * 3 + 2];
            }

            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            if (pz < minZ) minZ = pz;
            if (pz > maxZ) maxZ = pz;
        }

        const i = q * 6;
        indices[i] = vertex;
        indices[i + 1] = vertex + 1;
        indices[i + 2] = vertex + 2;
        indices[i + 3] = vertex;
        indices[i + 4] = vertex + 2;
        indices[i + 5] = vertex + 3;
    }

    const bounds = count > 0
        ? { minX, maxX, minY, maxY, minZ, maxZ }
        : { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

    return { positions, colors, normals, indices, quadCount: count, bounds };
}
