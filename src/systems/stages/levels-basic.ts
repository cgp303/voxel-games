import type { ILevelDescriptor } from '../../config/interfaces/interfaces';
import { createWave } from './WaveFactory';
import { WAVE_1_1, WAVE_1_2, WAVE_1_3, WAVE_LAZER_B } from './levels/waves';

/** Sample levels for testing the level system; wave count and formations vary on purpose. */
export function createBasicLevels(): ILevelDescriptor[] {
    return [
        {
            name: 'Level 1',
            waves: [
                () => createWave(WAVE_1_1),
                () => createWave(WAVE_1_2),
                () => createWave(WAVE_1_3),
            ],
        },
        {
            name: 'Level 2',
            waves: [
                () => createWave(WAVE_LAZER_B),
                () => createWave({ ...WAVE_LAZER_B, formation: 'X' }),
            ],
        },
    ];
}
