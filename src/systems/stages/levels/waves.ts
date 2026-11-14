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
export const NEON1_ROSTER: InvaderRowRoster = ['neon1', 'neon1', 'neon1', 'neon1', 'neon1', 'neon1'];
export const NEON2_ROSTER: InvaderRowRoster = ['neon2', 'neon2', 'neon2', 'neon2', 'neon2', 'neon2'];
export const NEON3_ROSTER: InvaderRowRoster = ['neon3', 'neon3', 'neon3', 'neon3', 'neon3', 'neon3'];
export const GREEN1_ROSTER: InvaderRowRoster = ['green1', 'green1', 'green1', 'green1', 'green1', 'green1'];
export const GREEN2_ROSTER: InvaderRowRoster = ['green2', 'green2', 'green2', 'green2', 'green2', 'green2'];
export const GREEN3_ROSTER: InvaderRowRoster = ['green3', 'green3', 'green3', 'green3', 'green3', 'green3'];
export const JEWEL1_ROSTER: InvaderRowRoster = ['jewel1', 'jewel1', 'jewel1', 'jewel1', 'jewel1', 'jewel1'];
export const JEWEL2_ROSTER: InvaderRowRoster = ['jewel2', 'jewel2', 'jewel2', 'jewel2', 'jewel2', 'jewel2'];
export const JEWEL3_ROSTER: InvaderRowRoster = ['jewel3', 'jewel3', 'jewel3', 'jewel3', 'jewel3', 'jewel3'];


const ENTRY: IStageConfig = { director: 'entry' };
const COLUMN_VERTICAL: IStageConfig = { director: 'columnVertical' };
const LAZER_B: IStageConfig = { director: 'lazerB', context: { maxSetIterations: 6 } };
const KAMAKAZI_DROPS: IStageConfig = { director: 'kamakaziDrops' };
const KAMAKAZI_DROPS_2: IStageConfig = { director: 'kamakaziDrops2' };


/** Level 1, wave 3: figure eight, then a column vertical on the second path. */
export const WAVE_1_1: IWaveConfig = {
    formation: 'Diamond',
    roster: ELITES_ROSTER,
    terrain: 'crystal',
    loopStartIndex: 1,
    stages: [
        ENTRY,
        { director: 'figureEight' },
        { director: 'columnVertical', context: { path: 1 } },
    ],
};




export const WAVE_1_2: IWaveConfig = {

    formation: 'Grid',
    roster: TIE_BOMBERS,
    terrain: 'crystal',
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
            weaponOverrides: { Mine: { dropChancePerFrame: { groupAttack1: [0.02, 0.1, 0.1] }, maxPerAttack: 5 } },
        },
        COLUMN_VERTICAL,
    ],
};

/** Level 1, wave 2: 2x2 group attack, then a column vertical. */
export const WAVE_1_3: IWaveConfig = {
    formation: 'X',
    roster: FIGHTER_BOMBERS,
    terrain: 'crystal',
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

/** A boss fight. The formation and roster are required by the wave format but a boss wave does not use them. */
export const WAVE_BOSS_1: IWaveConfig = {
    formation: 'Grid',
    roster: DEFAULT_ROW_ROSTER,
    terrain: 'crystal',
    loopStartIndex: 0,
    stages: [{ director: 'boss', bossId: 'boss1' }],
};

export const WAVE_2_1: IWaveConfig = {
    formation: 'Grid',
    roster: GREEN2_ROSTER,
    terrain: 'greyWorld',
    loopStartIndex: 1,
    stages: [
        ENTRY,
        KAMAKAZI_DROPS
    ],
};

export const WAVE_2_2: IWaveConfig = {
    formation: 'V',
    roster: GREEN1_ROSTER,
    terrain: 'greyWorld',
    loopStartIndex: 1,
    stages: [
        ENTRY,
        {
            director: 'groupAttack',
            sets: [['group3x3', 1, 0]],
            weaponOverrides: { Mine2: { dropChancePerFrame: { groupAttack1: [0.07, 0.06, 0.08] }, maxPerAttack: 8 } },
        },

    ],
};


export const WAVE_2_3: IWaveConfig = {
    formation: 'X',
    roster: GREEN3_ROSTER,
    terrain: 'greyWorld',
    loopStartIndex: 1,
    stages: [
        ENTRY,
        KAMAKAZI_DROPS,
        LAZER_B,
    ],
};

/** A boss fight. The formation and roster are required by the wave format but a boss wave does not use them. */
export const WAVE_BOSS_2: IWaveConfig = {
    formation: 'Grid',
    roster: DEFAULT_ROW_ROSTER,
    terrain: 'greyWorld',
    loopStartIndex: 0,
    stages: [{ director: 'boss', bossId: 'boss2' }],
};

/** A boss fight. The formation and roster are required by the wave format but a boss wave does not use them. */
export const WAVE_BOSS_3: IWaveConfig = {
    formation: 'Grid',
    roster: DEFAULT_ROW_ROSTER,
    terrain: 'neonWorld',
    loopStartIndex: 0,
    stages: [{ director: 'boss', bossId: 'boss3' }],
};

export const WAVE_3_1: IWaveConfig = {
    formation: 'V',
    roster: NEON1_ROSTER,
    terrain: 'neonWorld',
    loopStartIndex: 1,
    stages: [
        { director: 'entryFromAbove' },
        { director: 'verticalRows', context: { path: 1 } },
    ],
};

export const WAVE_3_2: IWaveConfig = {
    formation: 'X',
    roster: NEON2_ROSTER,
    terrain: 'neonWorld',
    loopStartIndex: 1,
    stages: [
        { director: 'entryFromAbove' },
        KAMAKAZI_DROPS,
        { director: 'verticalRows', context: { path: 1 } },
    ],
};

export const WAVE_3_3: IWaveConfig = {
    formation: 'X',
    formationPattern: 'simpleLoop2',
    roster: NEON3_ROSTER,
    terrain: 'neonWorld',
    loopStartIndex: 1,
    stages: [
        { director: 'entryFromAbove' },
        KAMAKAZI_DROPS_2,
        { director: 'verticalRows', context: { path: 1 } },
    ],
};

export const WAVE_4_1: IWaveConfig = {
    formation: 'X',
    formationPattern: 'simpleLoop2',
    roster: JEWEL3_ROSTER,
    terrain: 'greenWorld',
    loopStartIndex: 1,
    stages: [
        { director: 'entryFromAbove' },
        KAMAKAZI_DROPS_2,
        { director: 'verticalRows', context: { path: 1 } },
    ],
};


/** A boss fight. The formation and roster are required by the wave format but a boss wave does not use them. */
export const WAVE_BOSS_4: IWaveConfig = {
    formation: 'Grid',
    roster: DEFAULT_ROW_ROSTER,
    terrain: 'greenWorld',
    loopStartIndex: 0,
    stages: [{ director: 'boss', bossId: 'boss4' }],
};


/** Level 2 wave: lazer B attacks only. Used with the Diamond and X formations. */
export const WAVE_LAZER_B: IWaveConfig = {
    formation: 'Diamond',
    roster: ELITE_HEAVY_ROSTER,
    terrain: 'atari',
    loopStartIndex: 1,
    stages: [ENTRY, LAZER_B],
};





/** Demo attract mode: column vertical then lazer B. */
// export const WAVE_DEMO: IWaveConfig = {
//     formation: 'V',
//     roster: NEON3_ROSTER,
//     terrain: 'neonWorld',
//     loopStartIndex: 1,
//     stages: [ENTRY, { director: 'verticalRows', context: { path: 1 } }, COLUMN_VERTICAL, LAZER_B],
// };

// export const WAVE_DEMO: IWaveConfig = {
//     formation: 'V',
//     roster: DEFAULT_ROW_ROSTER,
//     terrain: 'crystal',
//     loopStartIndex: 1,
//     stages: [ENTRY, LAZER_B, KAMAKAZI_DROPS],
// };

/** Demo attract mode: the boss 3 arm prototype. */
export const WAVE_DEMO: IWaveConfig = WAVE_BOSS_4;
