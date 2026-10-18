// systems/stages/levels/waves.ts
// Wave definitions as plain data; WaveFactory turns each one into a StageQueue.

import type { IWaveConfig, IStageConfig } from '../WaveFactory';
import type { InvaderRowRoster } from '../../../config/types/types';

// Row index 0 is nearest the player; the highest row is at the top of the screen.
export const DEFAULT_ROW_ROSTER: InvaderRowRoster = ['scout', 'scout', 'fighter', 'fighter', 'elite', 'elite'];
export const ELITE_HEAVY_ROSTER: InvaderRowRoster = ['scout', 'scout', 'scout', 'tie', 'tie', 'tie'];
export const TIE_BOMBERS: InvaderRowRoster = ['tie', 'tie', 'tie', 'tie', 'tie', 'tie'];
export const FIGHTER_BOMBERS: InvaderRowRoster = ['fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'];
export const ELITES_ROSTER: InvaderRowRoster = ['elite', 'elite', 'elite', 'elite', 'elite', 'elite'];

const ENTRY: IStageConfig = { director: 'entry' };
const COLUMN_VERTICAL: IStageConfig = { director: 'columnVertical' };
const LAZER_B: IStageConfig = { director: 'lazerB', context: { maxSetIterations: 6 } };

/** Level 1, wave 1: diamond and 2x2 group attacks alternating with column verticals. */
export const WAVE_1_1: IWaveConfig = {
    formation: 'Grid',
    roster: TIE_BOMBERS,
    loopStartIndex: 1,
    stages: [
        ENTRY,
        {
            director: 'groupAttack',
            sets: [['groupTs', 2, 0]],
            weaponOverrides: { Mine: { dropChancePerFrame: { groupAttack1: [0.1, 0.1, 0.1] }, maxPerAttack: 5 } },
        },
        COLUMN_VERTICAL,
        {
            director: 'groupAttack',
            sets: [['group2x2', 2, 0]],
            weaponOverrides: { Mine: { dropChancePerFrame: { groupAttack1: [0.1, 0.1, 0.1] }, maxPerAttack: 5 } },
        },
        COLUMN_VERTICAL,
    ],
};

/** Level 1, wave 2: 2x2 group attack, then a column vertical. */
export const WAVE_1_2: IWaveConfig = {
    formation: 'X',
    roster: FIGHTER_BOMBERS,
    loopStartIndex: 1,
    stages: [
        ENTRY,
        {
            director: 'groupAttack',
            sets: [['group2x2', 1, 0]],
            weaponOverrides: { Mine: { dropChancePerFrame: { groupAttack1: [0.07, 0.06, 0.08] }, maxPerAttack: 8 } },
        },
        COLUMN_VERTICAL,
    ],
};

/** Level 1, wave 3: figure eight, then a column vertical on the second path. */
export const WAVE_1_3: IWaveConfig = {
    formation: 'Diamond',
    roster: ELITES_ROSTER,
    loopStartIndex: 1,
    stages: [
        ENTRY,
        { director: 'figureEight' },
        { director: 'columnVertical', context: { path: 1 } },
    ],
};

/** Level 2 wave: lazer B attacks only. Used with the Diamond and X formations. */
export const WAVE_LAZER_B: IWaveConfig = {
    formation: 'Diamond',
    roster: ELITE_HEAVY_ROSTER,
    loopStartIndex: 1,
    stages: [ENTRY, LAZER_B],
};

/** Demo attract mode: column vertical then lazer B. */
export const WAVE_DEMO: IWaveConfig = {
    formation: 'V',
    roster: DEFAULT_ROW_ROSTER,
    loopStartIndex: 1,
    stages: [ENTRY, COLUMN_VERTICAL, LAZER_B],
};
