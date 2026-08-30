import { createNoise2D, createNoise4D } from 'simplex-noise';

/**
 * Wrapper around simplex-noise with seeding support
 * Now supports 2D and 4D noise for tileable terrain
 */
export class NoiseGenerator {
    private noise2D: ReturnType<typeof createNoise2D>;
    private noise4D: ReturnType<typeof createNoise4D>;
    private seed: number;

    constructor(seed: number = 0) {
        this.seed = seed;

        // Seeded RNG for both 2D and 4D noise
        const rng = () => this.seededRandom();

        this.noise2D = createNoise2D(rng);
        this.noise4D = createNoise4D(rng);
    }

    /**
     * Seeded pseudo-random number generator
     * Returns value between 0 and 1
     */
    private seededRandom(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    /**
     * Get 2D noise value (-1 to 1)
     */
    public getValue(x: number, y: number): number {
        return this.noise2D(x, y);
    }

    /**
     * Get normalized 2D noise (0 to 1)
     */
    public getNormalized(x: number, y: number): number {
        return (this.getValue(x, y) + 1) / 2;
    }

    /**
     * Get 4D noise value (-1 to 1)
     */
    public getValue4D(x: number, y: number, z: number, w: number): number {
        return this.noise4D(x, y, z, w);
    }

    /**
     * Get normalized 4D noise (0 to 1)
     */
    public getNormalized4D(x: number, y: number, z: number, w: number): number {
        return (this.getValue4D(x, y, z, w) + 1) / 2;
    }

    /**
     * 4D fractal brownian motion (FBM)
     * Used for tileable torus-mapped terrain
     */
    public getPerlinNoise4D(
        x: number,
        y: number,
        z: number,
        w: number,
        octaves: number,
        persistence: number,
        lacunarity: number,
    ): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.getNormalized4D(
                x * frequency,
                y * frequency,
                z * frequency,
                w * frequency
            ) * amplitude;

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
