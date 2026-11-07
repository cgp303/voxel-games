import type { ITerrainStyle, ITerrainStyleSpec } from '../../config/interfaces/interfaces.ts';

/** Validates a style spec and returns the immutable style. Rows run along the direction of travel. */
export function createTerrainStyle(spec: ITerrainStyleSpec): ITerrainStyle {
    const { name, cols, rows } = spec;
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
        throw new RangeError(`TerrainStyle ${name}: cols and rows must be positive integers (got ${cols} x ${rows})`);
    }
    if (spec.ids.length !== cols * rows) {
        throw new RangeError(`TerrainStyle ${name}: ids needs cols * rows = ${cols * rows} entries, got ${spec.ids.length}`);
    }

    const introRows = spec.introRows ?? 0;
    const loopStartRow = spec.loopStartRow ?? introRows;
    const loopEndRow = spec.loopEndRow ?? rows;
    if (!Number.isInteger(introRows) || !Number.isInteger(loopStartRow) || !Number.isInteger(loopEndRow)) {
        throw new RangeError(`TerrainStyle ${name}: introRows, loopStartRow and loopEndRow must be integers`);
    }
    if (introRows < 0 || loopStartRow < introRows || loopEndRow <= loopStartRow || loopEndRow > rows) {
        throw new RangeError(
            `TerrainStyle ${name}: need 0 <= introRows (${introRows}) <= loopStartRow (${loopStartRow}) < loopEndRow (${loopEndRow}) <= rows (${rows})`,
        );
    }

    const ids = new Uint16Array(spec.ids.length);
    for (let i = 0; i < ids.length; i++) {
        const id = spec.ids[i];
        if (!Number.isInteger(id) || id < 0 || id > 0xffff) {
            throw new RangeError(`TerrainStyle ${name}: ids[${i}] is not a chunk id (got ${id})`);
        }
        ids[i] = id;
    }

    return { name, cols, rows, ids, introRows, loopStartRow, loopEndRow };
}

/**
 * Row of the style's id array shown `playedRows` rows after the style started (0 = its first row):
 * rows play in order up to loopEndRow, then wrap back to loopStartRow.
 */
export function styleRowAt(style: ITerrainStyle, playedRows: number): number {
    if (playedRows < style.loopStartRow) return playedRows;
    return style.loopStartRow + ((playedRows - style.loopStartRow) % (style.loopEndRow - style.loopStartRow));
}

/** Chunk id at a column of a style row; columns wrap in both directions. */
export function styleIdAt(style: ITerrainStyle, row: number, col: number): number {
    const c = ((col % style.cols) + style.cols) % style.cols;
    return style.ids[row * style.cols + c];
}
