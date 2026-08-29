import { VoxelWorld } from './VoxelWorld';
import { VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js';

export interface ParsedVoxModel {
    size: { x: number; y: number; z: number };
    voxels: Array<{ x: number; y: number; z: number; colorIndex: number }>;
    colors: Array<{ r: number; g: number; b: number; a: number }>;
}

export class VoxParser {
    /**
     * Parse a .vox file using Three.js VOXLoader
     */
    public static async parseVoxFile(arrayBuffer: ArrayBuffer): Promise<ParsedVoxModel> {
        const loader = new VOXLoader();
        const model = loader.parse(arrayBuffer);

        const voxels: Array<{ x: number; y: number; z: number; colorIndex: number }> = [];
        let size = { x: 1, y: 1, z: 1 };
        let palette: Array<{ r: number; g: number; b: number; a: number }> = [];

        if (model.chunks && model.chunks.length > 0) {
            const chunk = model.chunks[0];

            // Extract size
            if (chunk.size) {
                size = chunk.size;
            }

            // Extract voxels from data (4 bytes per voxel: x, y, z, colorIndex)
            if (chunk.data) {
                const data = chunk.data;
                for (let i = 0; i < data.length; i += 4) {
                    const x = data[i];
                    const y = data[i + 1];
                    const z = data[i + 2];
                    const colorIndex = data[i + 3];

                    voxels.push({ x, y, z, colorIndex });
                }
            }

            // Extract palette colors (convert from 32-bit ARGB to RGBA)
            if (chunk.palette) {
                palette = chunk.palette.map((color: number) => {
                    const a = (color >>> 24) & 0xFF;
                    const b = (color >>> 16) & 0xFF; // Changed from r to b
                    const g = (color >>> 8) & 0xFF;
                    const r = color & 0xFF;          // Changed from b to r

                    return { r, g, b, a };
                });
            }
        }

        if (palette.length === 0) {
            palette = this.createDefaultPalette(256);
        }

        return {
            size,
            voxels,
            colors: palette,
        };
    }

    /**
     * Load .vox file from path and parse it
     */
    public static async loadVoxFile(filePath: string): Promise<ParsedVoxModel> {
        const response = await fetch(filePath);
        const arrayBuffer = await response.arrayBuffer();
        return this.parseVoxFile(arrayBuffer);
    }

    /**
     * Parse voxel data into a VoxelWorld
     */
    public static populateWorld(world: VoxelWorld, parsedModel: ParsedVoxModel) {
        parsedModel.voxels.forEach((v) => {
            world.setVoxel(v.x, v.y, v.z, v.colorIndex);
        });
    }

    /**
     * Create a default palette if none is provided
     */
    private static createDefaultPalette(size: number): Array<{ r: number; g: number; b: number; a: number }> {
        const palette: Array<{ r: number; g: number; b: number; a: number }> = [];
        for (let i = 0; i < size; i++) {
            const hue = (i / size) * 360;
            const rgb = this.hslToRgb(hue, 100, 50);
            palette.push({ r: rgb.r, g: rgb.g, b: rgb.b, a: 255 });
        }
        return palette;
    }

    /**
     * Convert HSL to RGB
     */
    private static hslToRgb(
        h: number,
        s: number,
        l: number,
    ): { r: number; g: number; b: number } {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        };
    }
}
