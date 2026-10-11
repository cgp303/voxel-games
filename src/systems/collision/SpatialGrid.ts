import type { ICollisionGridBounds } from '../../config/interfaces/interfaces';

/**
 * Uniform X/Z grid, rebuilt every frame from flat typed arrays (counting sort, no per-frame allocation).
 * Boxes outside the bounds are clamped into the edge cells, so queries stay correct anywhere in the world;
 * every candidate is re-tested precisely by the caller.
 */
export class SpatialGrid {
    public readonly cols: number;
    public readonly rows: number;

    private readonly minX: number;
    private readonly minZ: number;
    private readonly invCellSize: number;
    private readonly cellStart: Int32Array;
    private readonly cursor: Int32Array;
    private items = new Int32Array(256);

    private count = 0;
    private firstCol = new Int32Array(64);
    private lastCol = new Int32Array(64);
    private firstRow = new Int32Array(64);
    private lastRow = new Int32Array(64);

    private stamps = new Uint32Array(64);
    private stampValue = 0;
    private found = new Int32Array(64);

    constructor(bounds: ICollisionGridBounds, cellSize: number) {
        if (!(cellSize > 0)) throw new RangeError('SpatialGrid: cellSize must be positive');
        this.minX = bounds.minX;
        this.minZ = bounds.minZ;
        this.invCellSize = 1 / cellSize;
        this.cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) * this.invCellSize));
        this.rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) * this.invCellSize));
        this.cellStart = new Int32Array(this.cols * this.rows + 1);
        this.cursor = new Int32Array(this.cols * this.rows);
    }

    /** Ids found by the last query(); only the first `query()` return value entries are valid. */
    public get candidates(): Readonly<Int32Array> {
        return this.found;
    }

    public begin(): void {
        this.count = 0;
    }

    /** Registers a box and returns its id (0, 1, 2, ... in call order). Call build() after the last insert. */
    public insert(minX: number, minZ: number, maxX: number, maxZ: number): number {
        const id = this.count++;
        if (id >= this.firstCol.length) this.growEntries();
        this.firstCol[id] = this.colOf(minX);
        this.lastCol[id] = this.colOf(maxX);
        this.firstRow[id] = this.rowOf(minZ);
        this.lastRow[id] = this.rowOf(maxZ);
        return id;
    }

    public build(): void {
        const { cols, cellStart, cursor } = this;
        cellStart.fill(0);

        let total = 0;
        for (let id = 0; id < this.count; id++) {
            for (let row = this.firstRow[id]; row <= this.lastRow[id]; row++) {
                for (let col = this.firstCol[id]; col <= this.lastCol[id]; col++) {
                    cellStart[row * cols + col + 1]++;
                    total++;
                }
            }
        }
        for (let cell = 0; cell < cursor.length; cell++) {
            cellStart[cell + 1] += cellStart[cell];
        }
        if (total > this.items.length) {
            this.items = new Int32Array(Math.max(total, this.items.length * 2));
        }

        cursor.set(cellStart.subarray(0, cursor.length));
        for (let id = 0; id < this.count; id++) {
            for (let row = this.firstRow[id]; row <= this.lastRow[id]; row++) {
                for (let col = this.firstCol[id]; col <= this.lastCol[id]; col++) {
                    this.items[cursor[row * cols + col]++] = id;
                }
            }
        }
    }

    /** Collects the unique ids of boxes sharing a cell with the query box into `candidates`; returns how many. */
    public query(minX: number, minZ: number, maxX: number, maxZ: number): number {
        if (this.count === 0) return 0;

        if (this.stampValue === 0xffffffff) {
            this.stamps.fill(0);
            this.stampValue = 0;
        }
        const stamp = ++this.stampValue;

        const firstCol = this.colOf(minX);
        const lastCol = this.colOf(maxX);
        const firstRow = this.rowOf(minZ);
        const lastRow = this.rowOf(maxZ);

        let found = 0;
        for (let row = firstRow; row <= lastRow; row++) {
            for (let col = firstCol; col <= lastCol; col++) {
                const cell = row * this.cols + col;
                for (let k = this.cellStart[cell]; k < this.cellStart[cell + 1]; k++) {
                    const id = this.items[k];
                    if (this.stamps[id] === stamp) continue;
                    this.stamps[id] = stamp;
                    this.found[found++] = id;
                }
            }
        }
        return found;
    }

    private colOf(x: number): number {
        const col = Math.floor((x - this.minX) * this.invCellSize);
        return col < 0 ? 0 : col >= this.cols ? this.cols - 1 : col;
    }

    private rowOf(z: number): number {
        const row = Math.floor((z - this.minZ) * this.invCellSize);
        return row < 0 ? 0 : row >= this.rows ? this.rows - 1 : row;
    }

    private growEntries(): void {
        const size = this.firstCol.length * 2;
        this.firstCol = grow(this.firstCol, size);
        this.lastCol = grow(this.lastCol, size);
        this.firstRow = grow(this.firstRow, size);
        this.lastRow = grow(this.lastRow, size);
        this.found = grow(this.found, size);
        const stamps = new Uint32Array(size);
        stamps.set(this.stamps);
        this.stamps = stamps;
    }
}

function grow(source: Int32Array<ArrayBuffer>, size: number): Int32Array<ArrayBuffer> {
    const out = new Int32Array(size);
    out.set(source);
    return out;
}
