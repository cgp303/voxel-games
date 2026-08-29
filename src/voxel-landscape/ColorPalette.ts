import { HeightColorBand } from './TerrainConfig';

/**
 * Maps normalized height (0-1) to colors with optional slope variation
 */
export class ColorPalette {
    private colorBands: HeightColorBand[];
    private slopeColorShift: number;

    constructor(colorBands: HeightColorBand[], slopeColorShift: number = 0.2) {
        // Sort bands by height for binary search
        this.colorBands = [...colorBands].sort((a, b) => a.height - b.height);
        this.slopeColorShift = slopeColorShift;
    }

    /**
     * Get color for a given height (0-1)
     */
    public getColorForHeight(normalizedHeight: number): { r: number; g: number; b: number } {
        // Clamp height to 0-1
        const h = Math.max(0, Math.min(1, normalizedHeight));

        // Find the two bands this height falls between
        let lowerBand = this.colorBands[0];
        let upperBand = this.colorBands[this.colorBands.length - 1];

        for (let i = 0; i < this.colorBands.length; i++) {
            if (this.colorBands[i].height <= h) {
                lowerBand = this.colorBands[i];
            }
            if (this.colorBands[i].height >= h) {
                upperBand = this.colorBands[i];
                break;
            }
        }

        // If exactly on a band, return that color
        if (lowerBand.height === upperBand.height) {
            return { ...lowerBand.color };
        }

        // Interpolate between bands
        const range = upperBand.height - lowerBand.height;
        const pos = (h - lowerBand.height) / range;

        return {
            r: Math.round(lowerBand.color.r + (upperBand.color.r - lowerBand.color.r) * pos),
            g: Math.round(lowerBand.color.g + (upperBand.color.g - lowerBand.color.g) * pos),
            b: Math.round(lowerBand.color.b + (upperBand.color.b - lowerBand.color.b) * pos),
        };
    }

    /**
     * Apply slope variation to a color
     * Steeper slopes get slightly darker/lighter for visual depth
     * slope: 0 = flat, 1 = max steepness
     */
    public applySlopeVariation(
        color: { r: number; g: number; b: number },
        slope: number,
    ): { r: number; g: number; b: number } {
        // Steeper = darker (shadow effect)
        const shift = -slope * this.slopeColorShift * 255;

        return {
            r: Math.max(0, Math.min(255, Math.round(color.r + shift))),
            g: Math.max(0, Math.min(255, Math.round(color.g + shift))),
            b: Math.max(0, Math.min(255, Math.round(color.b + shift))),
        };
    }

    /**
     * Get color for height with optional slope variation
     */
    public getColor(
        normalizedHeight: number,
        slope: number = 0,
        enableSlopeVariation: boolean = true,
    ): { r: number; g: number; b: number } {
        let color = this.getColorForHeight(normalizedHeight);

        if (enableSlopeVariation && this.slopeColorShift > 0) {
            color = this.applySlopeVariation(color, slope);
        }

        return color;
    }

    /**
     * Convert color to 24-bit RGB color index for voxel storage
     * Returns a color index value suitable for palette lookup
     */
    public colorToIndex(color: { r: number; g: number; b: number }): number {
        // For now, store as-is; actual indexing depends on how you build the palette
        // If using 256-color palette, would need to find closest match
        return (color.r << 16) | (color.g << 8) | color.b;
    }
}
