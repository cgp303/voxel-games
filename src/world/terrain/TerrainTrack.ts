import type { ITerrainStyle, TerrainTransitionAt } from '../../config/interfaces/interfaces.ts';
import { styleIdAt, styleRowAt } from './TerrainStyle.ts';

interface ITrackSegment {
    startRow: number;
    style: ITerrainStyle;
}

/**
 * The endless sequence of terrain rows: which chunk id belongs at global row `row`, column `col`.
 *
 * Rows are numbered from 0 in the direction of travel. The first style starts at row 0; each queued style
 * starts at a later row, plays its intro rows once, then loops. A transition can only start on a row nobody
 * has asked for yet (the rows past the visible window, hidden in the fog), so rows already on screen never change.
 */
export class TerrainTrack {
    private readonly segments: ITrackSegment[];
    private nextUnrequested = 0;

    constructor(first: ITerrainStyle) {
        this.segments = [{ startRow: 0, style: first }];
    }

    /** The first row that no caller has asked for yet; a style queued now starts here at the earliest. */
    public get nextRow(): number {
        return this.nextUnrequested;
    }

    /** Records that `row` is now on screen (or about to be), so transitions can no longer start at or before it. */
    public markRequested(row: number): void {
        if (row >= this.nextUnrequested) this.nextUnrequested = row + 1;
    }

    /**
     * Makes `style` take over from a future row and returns that row. 'nextRow' starts on the first row nobody has
     * asked for yet; 'loopEnd' waits until the current style has finished its loop pass, so a style is never cut mid-pass.
     * Styles queued back to back follow each other, at least one row apart.
     */
    public queueStyle(style: ITerrainStyle, at: TerrainTransitionAt = 'nextRow'): number {
        const last = this.segments[this.segments.length - 1];
        let startRow = Math.max(this.nextUnrequested, last.startRow + 1);

        if (at === 'loopEnd') {
            const passRows = last.style.loopEndRow - last.style.loopStartRow;
            const firstPassEnd = last.startRow + last.style.loopEndRow;
            startRow = Math.max(startRow, firstPassEnd);
            startRow = firstPassEnd + Math.ceil((startRow - firstPassEnd) / passRows) * passRows;
        }

        this.segments.push({ startRow, style });
        return startRow;
    }

    /** The style playing at `row`, or null before row 0. */
    public styleAt(row: number): ITerrainStyle | null {
        if (row < 0) return null;
        return this.segmentAt(row).style;
    }

    /** Chunk id at (row, col), or -1 before row 0. Columns wrap around the style's own width. */
    public idAt(row: number, col: number): number {
        if (row < 0) return -1;
        const { startRow, style } = this.segmentAt(row);
        return styleIdAt(style, styleRowAt(style, row - startRow), col);
    }

    private segmentAt(row: number): ITrackSegment {
        for (let i = this.segments.length - 1; i > 0; i--) {
            if (this.segments[i].startRow <= row) return this.segments[i];
        }
        return this.segments[0];
    }
}
