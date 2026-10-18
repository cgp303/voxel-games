import * as THREE from 'three';
import { VoxelWorld } from './VoxelWorld';
import { INVADER_MESH_MATERIAL, VOXEL_MESH } from '../config/data/constants';

type ColorPalette = Array<{ r: number; g: number; b: number; a: number }>;

// Face order matches the exposure bits: +X, -X, +Y, -Y, +Z, -Z.
// Four corners per face (winding gives outward-facing triangles), three numbers per corner.
const FACE_CORNERS = new Int8Array([
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
const FACE_NORMALS = new Int8Array([
    1, 0, 0,
    -1, 0, 0,
    0, -1, 0,
    0, 1, 0,
    0, 0, -1,
    0, 0, 1,
]);

const FACE_DIRECTIONS = 6;

/** Number of set bits for every possible 6-bit exposure mask. */
const FACES_IN_MASK = new Uint8Array(1 << FACE_DIRECTIONS);
for (let mask = 0; mask < FACES_IN_MASK.length; mask++) {
    let bits = 0;
    for (let bit = 0; bit < FACE_DIRECTIONS; bit++) bits += (mask >> bit) & 1;
    FACES_IN_MASK[mask] = bits;
}

/** Bit n is set when the neighbour in direction n is empty (or outside the world). */
function exposedFaceMask(
    cells: Readonly<Uint16Array>,
    index: number,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    strideZ: number,
): number {
    let mask = 0;
    if (x === width - 1 || cells[index + 1] === 0) mask |= 1;
    if (x === 0 || cells[index - 1] === 0) mask |= 2;
    if (y === height - 1 || cells[index + width] === 0) mask |= 4;
    if (y === 0 || cells[index - width] === 0) mask |= 8;
    if (z === depth - 1 || cells[index + strideZ] === 0) mask |= 16;
    if (z === 0 || cells[index - strideZ] === 0) mask |= 32;
    return mask;
}

/** Palette flattened to normalised r,g,b triples; an empty palette yields a single black entry. */
function buildColorTable(palette: ColorPalette): Float32Array {
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

export class VoxelGeometry {
    /**
     * Generate Three.js BufferGeometry from VoxelWorld with face culling optimization
     * Only renders faces that are exposed (not adjacent to another voxel).
     *
     * Two passes over the voxel array: the first counts exposed faces so the second can
     * fill exactly-sized typed arrays directly. No strings, per-voxel objects or growing
     * JS arrays are created.
     */
    public static generateGeometry(
        world: VoxelWorld,
        colorPalette: ColorPalette,
        centerGeometry: boolean = true,
    ): THREE.BufferGeometry {
        const { x: width, y: height, z: depth } = world.getDimensions();
        const cells = world.getCells();
        const strideZ = width * height;

        // Pass 1: count exposed faces
        let faceCount = 0;
        for (let z = 0, index = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++, index++) {
                    if (cells[index] === 0) continue;
                    faceCount += FACES_IN_MASK[
                        exposedFaceMask(cells, index, x, y, z, width, height, depth, strideZ)
                    ];
                }
            }
        }

        const vertexCount = faceCount * 4;
        const positions = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 3);
        const indices = new Uint32Array(faceCount * 6);
        const normals = VOXEL_MESH.flatFaceNormals ? new Float32Array(vertexCount * 3) : null;

        const colorTable = buildColorTable(colorPalette);
        const paletteSize = colorTable.length / 3;

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        // Pass 2: fill the buffers
        let vertex = 0;
        let face = 0;
        for (let z = 0, index = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++, index++) {
                    const cell = cells[index];
                    if (cell === 0) continue;

                    const mask = exposedFaceMask(cells, index, x, y, z, width, height, depth, strideZ);
                    if (mask === 0) continue;

                    const colorOffset = ((cell - 1) % paletteSize) * 3;
                    const r = colorTable[colorOffset];
                    const g = colorTable[colorOffset + 1];
                    const b = colorTable[colorOffset + 2];

                    for (let direction = 0; direction < FACE_DIRECTIONS; direction++) {
                        if ((mask & (1 << direction)) === 0) continue;

                        const cornerBase = direction * 12;
                        for (let corner = 0; corner < 4; corner++) {
                            const px = x + FACE_CORNERS[cornerBase + corner * 3];
                            const py = y + FACE_CORNERS[cornerBase + corner * 3 + 1];
                            const pz = z + FACE_CORNERS[cornerBase + corner * 3 + 2];
                            const at = (vertex + corner) * 3;

                            positions[at] = px;
                            positions[at + 1] = py;
                            positions[at + 2] = pz;
                            colors[at] = r;
                            colors[at + 1] = g;
                            colors[at + 2] = b;

                            if (normals) {
                                normals[at] = FACE_NORMALS[direction * 3];
                                normals[at + 1] = FACE_NORMALS[direction * 3 + 1];
                                normals[at + 2] = FACE_NORMALS[direction * 3 + 2];
                            }

                            if (px < minX) minX = px;
                            if (px > maxX) maxX = px;
                            if (py < minY) minY = py;
                            if (py > maxY) maxY = py;
                            if (pz < minZ) minZ = pz;
                            if (pz > maxZ) maxZ = pz;
                        }

                        const at = face * 6;
                        indices[at] = vertex;
                        indices[at + 1] = vertex + 1;
                        indices[at + 2] = vertex + 2;
                        indices[at + 3] = vertex;
                        indices[at + 4] = vertex + 2;
                        indices[at + 5] = vertex + 3;

                        vertex += 4;
                        face++;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        if (normals) {
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        }
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        if (!normals) {
            geometry.computeVertexNormals();
        }

        // Only center when requested (for invaders, not terrain)
        if (centerGeometry && faceCount > 0) {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const centerZ = (minZ + maxZ) / 2;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] -= centerX;
                positions[i + 1] -= centerY;
                positions[i + 2] -= centerZ;
            }
            geometry.boundingBox = new THREE.Box3(
                new THREE.Vector3(minX - centerX, minY - centerY, minZ - centerZ),
                new THREE.Vector3(maxX - centerX, maxY - centerY, maxZ - centerZ),
            );
        }

        return geometry;
    }

    public static createGeometry(
        world: VoxelWorld,
        colorPalette: Array<{ r: number; g: number; b: number; a: number }>,
        centerGeometry: boolean = false,
    ): THREE.BufferGeometry {
        return this.generateGeometry(world, colorPalette, centerGeometry);
    }

    public static createMaterial(
    ): THREE.Material {
        return INVADER_MESH_MATERIAL;
    }

    /**
     * Create a Three.js mesh from the generated geometry
     */
    public static createMesh(
        world: VoxelWorld,
        colorPalette: Array<{ r: number; g: number; b: number; a: number }>,
        centerGeometry: boolean = false,
    ): THREE.Mesh {
        const geometry = this.generateGeometry(world, colorPalette, centerGeometry);

        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            vertexColors: true,
            flatShading: false,  // ensure this is false
            roughness: 0.5,      // reduce from 0.7 (smoother)
            metalness: 0.0,      // reduce from 0.2
            normalScale: new THREE.Vector2(0.5, 0.5),  // add softer normals
        });
        // const material = new THREE.MeshPhongMaterial({
        //     side: THREE.DoubleSide,
        //     vertexColors: true,
        //     flatShading: false,
        //     shininess: 30,
        //     toneMapped: false,
        // });


        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }
}
