import * as THREE from 'three';
import type { AssetManager } from '../../assets/AssetManager';
import type { TrackLoad } from '../../ui/Preloader';
import { FONT_PATHS, fontGlyphPath } from '../../assets/manifests';
import type { IParsedVoxModel, IVoxelCloud } from '../../config/interfaces/interfaces';
import { TEXT } from '../../config/data/constants';
import { VoxelWorld } from '../../voxel/VoxelWorld';
import { VoxelGeometry } from '../../voxel/VoxelGeometry';
import { VoxParser } from '../../voxel/VoxParser';
import { buildVoxelCloud } from '../../voxel/VoxelCloud';

/**
 * One character ready to place. Glyph space: x runs across the used columns (0..width), y up from the
 * baseline (0..TEXT.cellHeight) and z is the thickness. The .vox files are z-up, so the file's z and y are swapped.
 */
export interface IGlyph {
    geometry: THREE.BufferGeometry;
    /** Voxels from the first to the last used column. */
    width: number;
    /** Centre of the glyph's voxels in glyph space; the cloud's positions are relative to it. */
    centre: { x: number; y: number; z: number };
    /** White voxel offsets from `centre`, used to explode the glyph. */
    cloud: IVoxelCloud;
}

/** The voxel font: every glyph in FONT_PATHS, imported through the AssetManager and cached as geometry. */
export class VoxelFont {
    private readonly glyphs = new Map<string, IGlyph>();

    /** Loads every glyph, counting each with `track` if given. A glyph that fails to load is skipped (and logged) so the rest still work. */
    public async load(assets: AssetManager, track: TrackLoad = (load) => load): Promise<void> {
        await Promise.all(
            Object.keys(FONT_PATHS).map(async (char) => {
                try {
                    const model = await track(assets.loadVox(FONT_PATHS[char], `font:${char}`));
                    const glyph = buildGlyph(model);
                    if (glyph) this.glyphs.set(char, glyph);
                } catch (err) {
                    console.warn(`[VoxelFont] could not load glyph "${char}":`, err);
                }
            }),
        );
    }

    /** Glyph for a character (case-insensitive), or undefined for spaces and characters the font lacks. */
    public get(char: string): IGlyph | undefined {
        return fontGlyphPath(char) ? this.glyphs.get(char.toLowerCase()) : undefined;
    }

    public dispose(): void {
        for (const glyph of this.glyphs.values()) glyph.geometry.dispose();
        this.glyphs.clear();
    }
}

function buildGlyph(model: IParsedVoxModel): IGlyph | null {
    if (model.voxels.length === 0) return null;

    // Trim empty columns on both sides so spacing is set by the gap alone. Height keeps its baseline.
    let minX = Infinity, maxX = -Infinity;
    let minHeight = Infinity, maxHeight = -Infinity;
    let minDepth = Infinity, maxDepth = -Infinity;
    for (const v of model.voxels) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.z < minHeight) minHeight = v.z;
        if (v.z > maxHeight) maxHeight = v.z;
        if (v.y < minDepth) minDepth = v.y;
        if (v.y > maxDepth) maxDepth = v.y;
    }

    const width = maxX - minX + 1;
    const height = Math.max(TEXT.cellHeight, maxHeight + 1);
    const depth = maxDepth + 1;
    const glyphModel: IParsedVoxModel = {
        size: { x: width, y: height, z: depth },
        voxels: model.voxels.map((v) => ({ x: v.x - minX, y: v.z, z: v.y, colorIndex: v.colorIndex })),
        colors: model.colors,
    };

    const world = new VoxelWorld(glyphModel.size);
    VoxParser.populateWorld(world, glyphModel);
    return {
        geometry: VoxelGeometry.createGeometry(world, glyphModel.colors, false),
        width,
        centre: { x: width / 2, y: (minHeight + maxHeight + 1) / 2, z: (minDepth + maxDepth + 1) / 2 },
        cloud: buildVoxelCloud(glyphModel),
    };
}
