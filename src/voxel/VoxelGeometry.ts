import * as THREE from 'three';
import { VoxelWorld, Voxel } from './VoxelWorld';

export class VoxelGeometry {
    /**
     * Generate Three.js BufferGeometry from VoxelWorld with face culling optimization
     * Only renders faces that are exposed (not adjacent to another voxel)
     */
    public static generateGeometry(
        world: VoxelWorld,
        colorPalette: Array<{ r: number; g: number; b: number; a: number }>,
    ): THREE.BufferGeometry {
        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        let vertexIndex = 0;

        const voxels = world.getAllVoxels();

        // Helper to check if a voxel exists at a position
        const hasVoxel = (x: number, y: number, z: number): boolean => {
            return world.getVoxel(x, y, z) !== undefined;
        };

        // Direction vectors for 6 faces
        const faces = [
            // +X face
            { normal: [1, 0, 0], vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
            // -X face
            { normal: [-1, 0, 0], vertices: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]] },
            // +Y face
            { normal: [0, 1, 0], vertices: [[0, 1, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1]] },
            // -Y face
            { normal: [0, -1, 0], vertices: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] },
            // +Z face
            { normal: [0, 0, 1], vertices: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] },
            // -Z face
            { normal: [0, 0, -1], vertices: [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0]] },
        ];

        const adjacentOffsets = [
            [1, 0, 0], // +X
            [-1, 0, 0], // -X
            [0, 1, 0], // +Y
            [0, -1, 0], // -Y
            [0, 0, 1], // +Z
            [0, 0, -1], // -Z
        ];

        // For each voxel, check which faces are exposed
        voxels.forEach((voxel: Voxel) => {
            const colorIndex = voxel.colorIndex || 0;
            const color = colorPalette[colorIndex % colorPalette.length];

            // Normalize color to 0-1 range
            const r = (color?.r || 0) / 255;
            const g = (color?.g || 0) / 255;
            const b = (color?.b || 0) / 255;

            // Check each face for exposure
            adjacentOffsets.forEach((offset, faceIndex) => {
                const adjX = voxel.x + offset[0];
                const adjY = voxel.y + offset[1];
                const adjZ = voxel.z + offset[2];

                // Only render this face if adjacent voxel doesn't exist
                if (!hasVoxel(adjX, adjY, adjZ)) {
                    const face = faces[faceIndex];

                    // Add vertices for this face
                    face.vertices.forEach((vertex) => {
                        positions.push(
                            voxel.x + vertex[0],
                            voxel.y + vertex[1],
                            voxel.z + vertex[2],
                        );
                        colors.push(r, g, b);
                    });

                    // Add indices for this face (two triangles)
                    indices.push(
                        vertexIndex,
                        vertexIndex + 1,
                        vertexIndex + 2,
                        vertexIndex,
                        vertexIndex + 2,
                        vertexIndex + 3,
                    );

                    vertexIndex += 4;
                }
            });
        });

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        geometry.computeVertexNormals();

        return geometry;
    }

    /**
     * Create a Three.js mesh from the generated geometry
     */
    public static createMesh(
        world: VoxelWorld,
        colorPalette: Array<{ r: number; g: number; b: number; a: number }>,
    ): THREE.Mesh {
        const geometry = this.generateGeometry(world, colorPalette);

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
