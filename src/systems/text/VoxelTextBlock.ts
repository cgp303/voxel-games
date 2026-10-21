import * as THREE from 'three';
import type { IVoxelTextStyle } from '../../config/interfaces/interfaces';
import type { VoxelFont } from './VoxelFont';
import { VoxelText } from './VoxelText';

/**
 * Several lines of voxel text, each centred on the block's origin and stacked down its local -Y axis
 * (top line first), so a flat block reads from the far end toward the camera. Place and orient `group`.
 */
export class VoxelTextBlock {
    public readonly group = new THREE.Group();

    private readonly lines: VoxelText[] = [];
    /** Extent of the block along its local Y axis, in world units. */
    public readonly height: number;

    /** @param lineHeight voxels from the middle of one line to the middle of the next. */
    constructor(font: VoxelFont, style: IVoxelTextStyle, lines: readonly string[], lineHeight: number) {
        this.group.name = 'VoxelTextBlock';
        const pitch = lineHeight * style.scale;
        const top = ((lines.length - 1) / 2) * pitch;
        lines.forEach((line, i) => {
            const text = new VoxelText(font, style);
            text.setText(line);
            text.group.position.y = top - i * pitch;
            this.group.add(text.group);
            this.lines.push(text);
        });
        this.height = lines.length * pitch;
    }

    public setColor(color: THREE.ColorRepresentation): void {
        for (const line of this.lines) line.setColor(color);
    }

    public dispose(): void {
        for (const line of this.lines) line.dispose();
        this.lines.length = 0;
        this.group.removeFromParent();
    }
}
