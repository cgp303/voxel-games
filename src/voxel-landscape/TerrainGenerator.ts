import { TerrainConfig } from './TerrainConfig';
import { NoiseGenerator } from './NoiseGenerator';
import { ColorPalette } from './ColorPalette';
import { ParsedVoxModel } from '../voxel/VoxParser';

/**
 * Generates procedural voxel terrain from a configuration
 * Creates a heightmap using simplex noise and colors based on height + slope
 */
export class TerrainGenerator {
    private config: TerrainConfig;
    private noiseGenerator: NoiseGenerator;
    private colorPalette: ColorPalette;
    private heightmap: number[][] = []; // Normalized heights 0-1

    constructor(config: TerrainConfig) {
        this.config = config;
        this.noiseGenerator = NoiseGenerator.withSeed(config.seed);
        this.colorPalette = new ColorPalette(config.colorBands, config.slopeColorShift);
    }

    /**
     * Generate a tileable heightmap using torus-mapped 4D simplex noise
     */
    private generateHeightmap(): void {
        this.heightmap = [];

        const width = this.config.width;
        const depth = this.config.depth;
        const tileSize = this.config.tileSize; // <-- add this to your config
        const scale = this.config.noiseScale;

        for (let z = 0; z < depth; z++) {
            const row: number[] = [];

            for (let x = 0; x < width; x++) {

                // Convert (x,z) into normalized tile coordinates
                const u = x / tileSize;
                const v = z / tileSize;

                // Map onto a 4D torus
                const nx = Math.cos(2 * Math.PI * u);
                const ny = Math.sin(2 * Math.PI * u);
                const nz = Math.cos(2 * Math.PI * v);
                const nw = Math.sin(2 * Math.PI * v);

                // Sample 4D simplex noise (tileable)
                let height = this.noiseGenerator.getPerlinNoise4D(
                    nx * scale,
                    ny * scale,
                    nz * scale,
                    nw * scale,
                    this.config.noiseOctaves,
                    this.config.noisePersistence,
                    this.config.noiseLacunarity
                );

                // Normalize noise4D output (-1..1) → (0..1)
                height = (height + 1) * 0.5;

                // Apply height curve exponent
                height = Math.pow(height, 1 / this.config.noiseExponent);

                row.push(height);
            }

            this.heightmap.push(row);
        }
    }

    /**
     * Calculate slope at a given position (for slope variation)
     * Returns value 0-1 where 1 is steepest
     */
    private calculateSlope(x: number, z: number): number {
        const h = this.heightmap[z][x];

        let slopeSum = 0;
        let sampleCount = 0;

        // Check 4 adjacent cells
        const neighbors = [
            [x + 1, z],
            [x - 1, z],
            [x, z + 1],
            [x, z - 1],
        ];

        for (const [nx, nz] of neighbors) {
            if (nx >= 0 && nx < this.config.width && nz >= 0 && nz < this.config.depth) {
                const neighborHeight = this.heightmap[nz][nx];
                slopeSum += Math.abs(h - neighborHeight);
                sampleCount++;
            }
        }

        // Normalize slope to 0-1 range
        // Max change is 1.0 per neighbor, so max sum is 4.0
        const avgSlope = slopeSum / sampleCount;
        return Math.min(1, avgSlope * 2); // Scale to reasonable range
    }

    /**
     * Build a color palette for the voxels
     * Creates unique colors for each height band + slope variation combo
     */
    private buildColorPalette(): Array<{ r: number; g: number; b: number; a: number }> {
        const palette: Array<{ r: number; g: number; b: number; a: number }> = [];

        // Build a palette with slope variations
        // Store colors as: [baseColors(7 bands) × 5 slope levels]
        for (let heightBand = 0; heightBand < this.config.colorBands.length; heightBand++) {
            const bandColor = this.config.colorBands[heightBand];
            const h = bandColor.height;

            // Add variations for different slopes (flat to steep)
            for (let slopeLevel = 0; slopeLevel < 5; slopeLevel++) {
                const slope = slopeLevel / 4; // 0.0 to 1.0
                const color = this.colorPalette.getColor(h, slope, this.config.enableSlopeVariation);
                palette.push({ ...color, a: 255 });
            }
        }

        return palette;
    }

    /**
     * Find closest color index in palette for a given color
     */
    private findColorIndex(targetColor: { r: number; g: number; b: number }, palette: any[]): number {
        let bestIndex = 0;
        let bestDistance = Infinity;

        for (let i = 0; i < palette.length; i++) {
            const color = palette[i];
            const distance =
                Math.pow(color.r - targetColor.r, 2) +
                Math.pow(color.g - targetColor.g, 2) +
                Math.pow(color.b - targetColor.b, 2);

            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    /**
     * Generate the full terrain as a ParsedVoxModel
     */
    public generate(): ParsedVoxModel {
        // Step 1: Generate heightmap
        this.generateHeightmap();

        // Step 2: Build color palette
        const palette = this.buildColorPalette();

        // Step 3: Generate voxels from heightmap
        const voxels: Array<{ x: number; y: number; z: number; colorIndex: number }> = [];

        for (let z = 0; z < this.config.depth; z++) {
            for (let x = 0; x < this.config.width; x++) {
                const normalizedHeight = this.heightmap[z][x];
                const slope = this.calculateSlope(x, z);
                const height = Math.round(normalizedHeight * this.config.maxHeight);

                // Get color for this position
                const color = this.colorPalette.getColor(
                    normalizedHeight,
                    slope,
                    this.config.enableSlopeVariation,
                );

                // Find matching color in palette
                const colorIndex = this.findColorIndex(color, palette);

                // Stack voxels from y=0 to y=height
                for (let y = 0; y < height; y++) {
                    voxels.push({
                        x,
                        y,
                        z,
                        colorIndex,
                    });
                }
            }
        }

        return {
            size: {
                x: this.config.width,
                y: this.config.maxHeight,
                z: this.config.depth,
            },
            voxels,
            colors: palette,
        };
    }

    /**
     * Get the generated heightmap (for debugging/visualization)
     */
    public getHeightmap(): number[][] {
        return this.heightmap;
    }

    /**
     * Serialize config for storage
     */
    public getConfig(): TerrainConfig {
        return this.config;
    }
}
