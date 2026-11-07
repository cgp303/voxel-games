import * as THREE from 'three';
import type { IZRange } from '../../config/interfaces/interfaces.ts';
import { CHUNK_X, CHUNK_Z, type ChunkLibrary } from './ChunkLibrary.ts';
import { TerrainBelt } from './TerrainBelt.ts';
import type { TerrainTrack } from './TerrainTrack.ts';

const INITIAL_VERTICES = 8192;
const INITIAL_INDICES = 12288;

/**
 * Draws the terrain belt: every visible chunk is one instance of a single BatchedMesh (one draw call).
 *
 * Instances are a pool of `maxRows` row slots of `cols` chunks. Only rows that overlap the visible Z range are
 * filled; when the ground has scrolled one row, the row that left is reused for the one entering at the far end
 * by swapping its chunk geometries, so nothing is allocated while playing. BatchedMesh culls each instance
 * against the camera frustum (and the shadow camera's), so chunks behind or beside the camera cost nothing.
 *
 * Instance matrices are stored relative to whole rows scrolled; the mesh itself carries the sub-row offset,
 * so scrolling only moves one object and numbers stay small however far the ground has travelled.
 */
export class ChunkField {
    public readonly mesh: THREE.BatchedMesh;
    public readonly belt: TerrainBelt;

    private readonly library: ChunkLibrary;
    private readonly track: TerrainTrack;
    private readonly cols: number;
    private readonly maxRows: number;
    /** Row shown by each slot, or -1 when the slot is empty. */
    private readonly slotRows: Int32Array;
    /** BatchedMesh geometry id per (chunk id * 2 + 1 with border faces), -1 for a mesh with nothing to draw. */
    private readonly geometryIds = new Map<number, number>();
    private readonly matrix = new THREE.Matrix4();

    private vertexCapacity = INITIAL_VERTICES;
    private indexCapacity = INITIAL_INDICES;
    private vertexUsed = 0;
    private indexUsed = 0;
    /** Whole rows scrolled when the instance matrices were written. */
    private matrixBase = 0;

    constructor(
        library: ChunkLibrary,
        track: TerrainTrack,
        options: { cols: number; maxRows: number; zBase?: number; castShadow?: boolean; material?: THREE.Material },
    ) {
        this.library = library;
        this.track = track;
        this.cols = options.cols;
        this.maxRows = options.maxRows;
        this.belt = new TerrainBelt(library, track, { cols: options.cols, zBase: options.zBase });
        this.slotRows = new Int32Array(options.maxRows).fill(-1);

        const material =
            options.material ??
            new THREE.MeshStandardMaterial({
                side: THREE.DoubleSide,
                vertexColors: true,
                flatShading: false,
                roughness: 0.5,
                metalness: 0.0,
                normalScale: new THREE.Vector2(0.5, 0.5),
            });
        this.mesh = new THREE.BatchedMesh(options.cols * options.maxRows, this.vertexCapacity, this.indexCapacity, material);
        this.mesh.name = 'Terrain';
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = options.castShadow ?? false;
        // The batch culls each instance itself; the cached whole-batch bounds would go stale as rows recycle.
        this.mesh.frustumCulled = false;
        this.mesh.perObjectFrustumCulled = true;

        // Instance ids are slot * cols + col. Geometry 0 does not exist yet, but invisible instances are never drawn.
        for (let i = 0; i < options.cols * options.maxRows; i++) {
            this.mesh.setVisibleAt(this.mesh.addInstance(0), false);
        }
    }

    /**
     * Scrolls the belt, then shows exactly the rows that overlap `visible` (plus `rowMargin` either side), or
     * nothing when it is null. Rows are requested from the track here, so a style queued afterwards starts
     * beyond everything that has been on screen.
     */
    public update(scrolled: number, visible: IZRange | null, rowMargin: number): void {
        const belt = this.belt;
        belt.advance(scrolled);

        const base = Math.floor(belt.travelled / CHUNK_Z);
        // Matrices are relative to `base`, so every slot is rewritten when it changes.
        const rebase = base !== this.matrixBase;
        this.matrixBase = base;
        this.mesh.position.z = belt.zBase - (belt.travelled - base * CHUNK_Z);

        let first = 0;
        let last = -1;
        if (visible) {
            first = Math.max(0, belt.rowAt(visible.min) - rowMargin);
            last = belt.rowAt(visible.max) + rowMargin;
            if (last - first + 1 > this.maxRows) last = first + this.maxRows - 1;
        }

        for (let slot = 0; slot < this.maxRows; slot++) {
            let wanted = -1;
            if (last >= first) {
                const row = first + ((((slot - first) % this.maxRows) + this.maxRows) % this.maxRows);
                if (row <= last) wanted = row;
            }
            if (!rebase && wanted === this.slotRows[slot]) continue;
            this.slotRows[slot] = wanted;
            this.fillSlot(slot, wanted);
        }
    }

    public dispose(): void {
        this.mesh.removeFromParent();
        this.mesh.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }

    private fillSlot(slot: number, row: number): void {
        // Which mesh a chunk gets depends on the rows either side of it, so those rows are fixed from now on too.
        if (row >= 0) this.track.markRequested(row + 1);

        for (let col = 0; col < this.cols; col++) {
            const instance = slot * this.cols + col;
            const geometryId = row >= 0 ? this.geometryFor(this.track.idAt(row, col), this.needsBorderFaces(row, col)) : -1;
            if (geometryId < 0) {
                this.mesh.setVisibleAt(instance, false);
                continue;
            }
            this.matrix.makeTranslation(this.belt.minX + col * CHUNK_X, 0, (row - this.matrixBase) * CHUNK_Z);
            this.mesh.setGeometryIdAt(instance, geometryId);
            this.mesh.setMatrixAt(instance, this.matrix);
            this.mesh.setVisibleAt(instance, true);
        }
    }

    /**
     * A neutral chunk drops its border faces because its neighbour is solid there; beside an open (hand-authored) chunk that
     * is not so, and the faces are needed. The belt's own edges and rows before row 0 have no neighbour to see.
     */
    private needsBorderFaces(row: number, col: number): boolean {
        if (!this.library.get(this.track.idAt(row, col)).sealed) return false;
        return (
            !this.isSealedOrAbsent(row - 1, col) ||
            !this.isSealedOrAbsent(row + 1, col) ||
            !this.isSealedOrAbsent(row, col - 1) ||
            !this.isSealedOrAbsent(row, col + 1)
        );
    }

    private isSealedOrAbsent(row: number, col: number): boolean {
        if (row < 0 || col < 0 || col >= this.cols) return true;
        return this.library.get(this.track.idAt(row, col)).sealed;
    }

    /** Adds the chunk's mesh (with or without its border faces) to the batch the first time it is shown. */
    private geometryFor(chunkId: number, borderFaces: boolean): number {
        const key = chunkId * 2 + (borderFaces ? 1 : 0);
        const known = this.geometryIds.get(key);
        if (known !== undefined) return known;

        const buffers = borderFaces ? this.library.openBuffers(chunkId) : this.library.get(chunkId).buffers;
        let geometryId = -1;
        if (buffers.quadCount > 0) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals!, 3));
            geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
            this.reserve(buffers.positions.length / 3, buffers.indices.length);
            geometryId = this.mesh.addGeometry(geometry);
        }
        this.geometryIds.set(key, geometryId);
        return geometryId;
    }

    /** Grows the batch's vertex and index buffers when the next geometry would not fit. */
    private reserve(vertices: number, indices: number): void {
        this.vertexUsed += vertices;
        this.indexUsed += indices;
        if (this.vertexUsed <= this.vertexCapacity && this.indexUsed <= this.indexCapacity) return;

        while (this.vertexUsed > this.vertexCapacity) this.vertexCapacity *= 2;
        while (this.indexUsed > this.indexCapacity) this.indexCapacity *= 2;
        this.mesh.setGeometrySize(this.vertexCapacity, this.indexCapacity);
    }
}
