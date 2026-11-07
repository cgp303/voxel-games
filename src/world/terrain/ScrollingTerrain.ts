import * as THREE from 'three';
import type { IGradient2, ITerrainStyle, IViewFrustum, TerrainTransitionAt } from '../../config/interfaces/interfaces.ts';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, type ChunkLibrary } from './ChunkLibrary.ts';
import { ChunkField } from './ChunkField.ts';
import { TerrainTrack } from './TerrainTrack.ts';
import { visibleGroundRange } from './visibleGroundRange.ts';

const view: IViewFrustum = {
    origin: { x: 0, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 0 },
    tanHalfFovX: 0,
    tanHalfFovY: 0,
};

/** Reads the camera's pose (three.js cameras look down their local -Z) into the shared `view` object. */
function readView(camera: THREE.PerspectiveCamera): IViewFrustum {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    view.right.x = e[0]; view.right.y = e[1]; view.right.z = e[2];
    view.up.x = e[4]; view.up.y = e[5]; view.up.z = e[6];
    view.forward.x = -e[8]; view.forward.y = -e[9]; view.forward.z = -e[10];
    view.origin.x = e[12]; view.origin.y = e[13]; view.origin.z = e[14];
    view.tanHalfFovY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.zoom;
    view.tanHalfFovX = view.tanHalfFovY * camera.aspect;
    return view;
}

/**
 * The endless terrain: a style sequence (TerrainTrack) laid out as a belt of chunks that scrolls toward the camera
 * and is drawn only as far as the camera can see it (the view frustum, up to the fog depth).
 */
export class ScrollingTerrain {
    public readonly library: ChunkLibrary;
    public readonly track: TerrainTrack;
    public readonly field: ChunkField;
    /** Terrain extent in voxels; `depth` is the length the camera framing is based on (see TERRAIN.framingDepth). */
    public readonly bounds: { width: number; height: number; depth: number };

    private readonly rowMargin: number;
    private anchored = false;
    private visibleNear: number | null = null;

    constructor(
        library: ChunkLibrary,
        first: ITerrainStyle,
        options: { cols: number; maxRows: number; rowMargin: number; framingDepth: number; castShadow: boolean },
    ) {
        this.library = library;
        this.track = new TerrainTrack(first);
        this.field = new ChunkField(library, this.track, {
            cols: options.cols,
            maxRows: options.maxRows,
            castShadow: options.castShadow,
        });
        this.rowMargin = options.rowMargin;
        this.bounds = { width: options.cols * CHUNK_X, height: CHUNK_Y, depth: options.framingDepth };
    }

    /** The style the terrain ends on: the one playing, or the latest queued (which may not be on screen yet). */
    public get currentStyle(): ITerrainStyle {
        return this.track.currentStyle;
    }

    /**
     * Makes `style` take over from a row that is not on screen yet and returns that row; null when `style` is already
     * what the terrain ends on. A style queued earlier that has not appeared yet is replaced. See TerrainTrack.queueStyle.
     */
    public queueStyle(style: ITerrainStyle, at: TerrainTransitionAt = 'nextRow'): number | null {
        return this.track.queueStyle(style, at);
    }

    /** World Z of the near edge of `row` right now; it moves toward -Z as the ground scrolls. */
    public rowNearZ(row: number): number {
        return this.field.belt.rowMinZ(row);
    }

    /** World Z of the bottom of the visible ground as of the latest update (null before the first, or when no ground is in view). */
    public get visibleNearZ(): number | null {
        return this.visibleNear;
    }

    /**
     * Scrolls the ground by `scrolled` units toward -Z and shows the rows `camera` can see, as far as `fogDepth`.
     * The first row starts at the nearest visible ground the first time the camera is above the terrain, so a
     * style's intro is what the player sees first.
     */
    public update(scrolled: number, camera: THREE.PerspectiveCamera, fogDepth: number): void {
        const frustum = readView(camera);
        const visible = visibleGroundRange(frustum, 0, CHUNK_Y, Math.min(fogDepth, camera.far));
        this.visibleNear = visible ? visible.min : null;

        if (!this.anchored && visible && frustum.origin.y > CHUNK_Y) {
            this.field.belt.zBase = Math.floor(visible.min / CHUNK_Z) * CHUNK_Z;
            this.anchored = true;
        }
        this.field.update(this.anchored ? scrolled : 0, this.anchored ? visible : null, this.rowMargin);
    }

    /** World Y of the terrain surface at world X/Z, or -Infinity where there is no ground. */
    public heightAt(x: number, z: number): number {
        return this.field.belt.heightAt(x, z);
    }

    public gradientAt(x: number, z: number, out: IGradient2): IGradient2 {
        return this.field.belt.gradientAt(x, z, out);
    }

    public dispose(): void {
        this.field.dispose();
    }
}
