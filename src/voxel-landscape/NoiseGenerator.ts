import { createNoise2D } from 'simplex-noise';

/**
 * Wrapper around simplex-noise with seeding support
 * Generates Perlin-like noise for terrain height variation
 */
export class NoiseGenerator {
    private noise: ReturnType<typeof createNoise2D>;
    private seed: number;

    constructor(seed: number = 0) {
        this.seed = seed;
        // createNoise2D accepts a random number generator function
        // We create one seeded with our seed value
        this.noise = createNoise2D(() => this.seededRandom());
    }

    /**
     * Seeded pseudo-random number generator
     * Returns value between 0 and 1
     */
    private seededRandom(): number {
        // Simple LCG (Linear Congruential Generator)
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    /**
     * Get noise value at 2D position
     * Returns value between -1 and 1
     */
    public getValue(x: number, y: number): number {
        return this.noise(x, y);
    }

    /**
     * Get normalized noise value (0 to 1)
     */
    public getNormalized(x: number, y: number): number {
        return (this.getValue(x, y) + 1) / 2;
    }

    /**
     * Perlin noise with multiple octaves (fractal brownian motion)
     * Creates more natural terrain with multiple scales of variation
     */
    public getPerlinNoise(
        x: number,
        y: number,
        octaves: number,
        persistence: number,
        lacunarity: number,
    ): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.getNormalized(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }

    /**
     * Create a new noise generator with different seed
     */
    public static withSeed(seed: number): NoiseGenerator {
        return new NoiseGenerator(seed);
    }
}
