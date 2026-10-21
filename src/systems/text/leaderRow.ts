import type { VoxelFont } from './VoxelFont';
import { VoxelText } from './VoxelText';

const MIN_DOTS = 3;

/**
 * A line like `ACE ........... 50000`: `left`, a run of dots, then `right`, with as many dots as bring the
 * line closest to `width` voxels (the font is proportional, so the nearest whole dot is as close as it gets).
 */
export function leaderRow(font: VoxelFont, left: string, right: string, width: number): string {
    const row = (dots: number): string => `${left} ${'.'.repeat(dots)} ${right}`;
    let dots = MIN_DOTS;
    while (VoxelText.measure(font, row(dots + 1)) <= width) dots++;
    const under = width - VoxelText.measure(font, row(dots));
    const over = VoxelText.measure(font, row(dots + 1)) - width;
    return row(over < under ? dots + 1 : dots);
}
