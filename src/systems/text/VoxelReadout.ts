import * as THREE from 'three';
import type { IVoxelTextStyle } from '../../config/interfaces/interfaces';
import { TEXT } from '../../config/data/constants';
import type { VoxelFont } from './VoxelFont';
import { VoxelText } from './VoxelText';

/**
 * A short number drawn one character per fixed-width cell, so digits keep their places however narrow a glyph is,
 * and a change rebuilds only the cells whose character changed. The readout runs right from the group's origin
 * (its left edge) and is centred on the group's local Y. Cells are added as the value grows longer.
 */
export class VoxelReadout {
    public readonly group = new THREE.Group();

    private readonly font: VoxelFont;
    private readonly style: IVoxelTextStyle;
    /** Voxels from the start of one cell to the start of the next. */
    private readonly cellVoxels: number;
    /** Voxels across the widest digit. */
    private readonly digitVoxels: number;
    private readonly cells: VoxelText[] = [];
    private readonly shown: string[] = [];

    constructor(font: VoxelFont, style: IVoxelTextStyle) {
        this.font = font;
        this.style = style;
        this.group.name = 'VoxelReadout';

        let widest = 0;
        for (const digit of '0123456789') widest = Math.max(widest, font.get(digit)?.width ?? 0);
        this.digitVoxels = widest > 0 ? widest : TEXT.spaceWidth;
        this.cellVoxels = this.digitVoxels + (style.letterGap ?? TEXT.letterGap);
    }

    /** Shows `value`, one character per cell. Only cells whose character changed are rebuilt. */
    public setValue(value: string): void {
        while (this.cells.length < value.length) this.addCell();
        for (let i = 0; i < this.cells.length; i++) {
            const char = value[i] ?? '';
            if (this.shown[i] === char) continue;
            this.cells[i].setText(char);
            this.shown[i] = char;
        }
    }

    public dispose(): void {
        for (const cell of this.cells) cell.dispose();
        this.cells.length = 0;
        this.shown.length = 0;
        this.group.removeFromParent();
    }

    private addCell(): void {
        const cell = new VoxelText(this.font, this.style);
        // Each cell is centred on its own origin, so a narrow glyph sits in the middle of its cell.
        cell.group.position.x = (this.cells.length * this.cellVoxels + this.digitVoxels / 2) * this.style.scale;
        this.group.add(cell.group);
        this.cells.push(cell);
        this.shown.push('');
    }
}
