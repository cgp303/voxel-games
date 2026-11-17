// systems/stages/WaveFactory.ts

import { Stage } from './Stage';
import { StageQueue } from './StageQueue';
import { EntryPatternDirector, type EntryPatternBuilderType } from '../patterns/directors/EntryPatternDirector';
import { GroupAttackPatternDirector } from '../patterns/directors/GroupAttackPatternDirector';
import { ColumnVerticalDirector } from '../patterns/directors/ColumnVerticalDirector';
import { ColumnDivesDirector } from '../patterns/directors/ColumnDivesDirector';
import { FigureEightDirector } from '../patterns/directors/FigureEightDirector';
import { LazerBAttackPatternDirector } from '../patterns/directors/LazerBAttackPatternDirector';
import { BossDirector } from '../patterns/directors/BossDirector';
import {
    makeGridFormation,
    makeVFormation,
    makeXFormation,
    makeDiamondFormation,
} from '../patterns/formations/formationBuilders';
import type { IFormationDescriptor, IPatternDirector, IWeaponOverrides } from '../../config/interfaces/interfaces';
import type { GroupKind, InvaderRowRoster, PatternType, TerrainStyleId } from '../../config/types/types';
import { KamakaziDropsDirector } from '../patterns/directors/KamakaziDropsDirector';
import { VerticalRowsDirector } from '../patterns/directors/VerticalRowsDirector';
import { KamakaziDropsDirector2 } from '../patterns/directors/KamakaziDropsDirector2';
import { KamakaziDropsDirector3 } from '../patterns/directors/KamakaziDropsDirector3';

import { ReverseColumnVerticalDirector } from '../patterns/directors/ReverseColumnVerticalDirector';

interface IStageConfigBase {
    /** Merged over the default `{ orientation: 'front' }` and passed to the director (e.g. `path`, `maxSetIterations`). */
    context?: Record<string, any>;
    /** Overrides the director's default fire rate. */
    fireRate?: number;
    /** Overrides the director's default missile strength. */
    missileStrength?: number;
    /** Replaces INVADER_WEAPONS settings while this stage runs. */
    weaponOverrides?: IWeaponOverrides;
}

/** One stage of a wave. Everything the factory needs to build a Stage and its director. */
export type IStageConfig =
    | IStageBase<'entry' | 'entryFromAbove' | 'entryFromBelow' | 'entryStandardBezier' | 'entrySpiral' | 'entrySwoopingDive' | 'columnVertical' | 'columnDives' | 'figureEight' | 'lazerB' | 'kamakaziDrops' | 'kamakaziDrops2' | 'kamakaziDrops3' | 'verticalRows' | 'reverseColumnVertical'>
    /** A boss fight; the wave is over when the boss is dead. The wave's formation and roster are not used (give any valid ones). */
    | (IStageBase<'boss'> & { bossId: string })
    | (IStageBase<'groupAttack'> & {
        /** `[patternName, repeats, startIndex]`; the wave's formation (`Grid`, `X`, ...) is appended to the name. */
        sets: [GroupKind, number, number][];
    });

type IStageBase<D extends string> = IStageConfigBase & { director: D };

/** A wave as plain data: formation, who sits in each row, the ordered stages, and the terrain it is played on. */
export interface IWaveConfig {
    formation: PatternType;
    formationPattern?: string;
    /** Row 0 is nearest the player. Must have one entry per formation row. */
    roster: InvaderRowRoster;
    stages: IStageConfig[];
    /** Stage index the queue returns to after the last stage. */
    loopStartIndex: number;
    /** Terrain style (a TERRAIN_STYLES id). When it differs from the wave before, the ground speeds up between the two waves. */
    terrain: TerrainStyleId;

}

type DirectorKey = IStageConfig['director'];

interface IDirectorEntry {
    stageName: string;
    fireRate: number;
    missileStrength: number;
    patternBuilder?: EntryPatternBuilderType;
    create: (config: IStageConfig, formation: PatternType) => IPatternDirector;
}

// /** Map entry director type to pattern builder type */
// const ENTRY_PATTERN_BUILDERS: Record<'entry' | 'entryStandardBezier' | 'entryStraightLine' | 'entrySpiral' | 'entrySwoopingDive', EntryPatternBuilderType> = {
//     entry: 'standard',
//     entryStandardBezier: 'standard',
//     entrySpiral: 'spiral',
//     entrySwoopingDive: 'swoopingDive',
// };

/** Directors are stateful, so each wave build creates fresh ones. Defaults are the usual rates for each. */
const DIRECTORS: Record<DirectorKey, IDirectorEntry> = {
    entry: {
        stageName: 'Entry',
        fireRate: 0.5,
        missileStrength: 1.0,
        patternBuilder: 'standard',
        create: () => new EntryPatternDirector(),
    },
    entryStandardBezier: {
        stageName: 'Entry Standard Bezier',
        fireRate: 0.5,
        missileStrength: 1.0,
        patternBuilder: 'standard',
        create: () => new EntryPatternDirector(),
    },
    entryFromAbove: {
        stageName: 'Entry From Above',
        fireRate: 0.5,
        missileStrength: 1.0,
        patternBuilder: 'fromAbove',
        create: () => new EntryPatternDirector(),
    },
    entryFromBelow: {
        stageName: 'Entry From Below',
        fireRate: 0.5,
        missileStrength: 1.0,
        patternBuilder: 'fromBelow',
        create: () => new EntryPatternDirector(),
    },
    entrySpiral: {
        stageName: 'Entry Spiral',
        fireRate: 0.5,
        missileStrength: 1.0,
        patternBuilder: 'spiral',
        create: () => new EntryPatternDirector(),
    },
    entrySwoopingDive: {
        stageName: 'Entry Swooping Dive',
        fireRate: 0.5,
        missileStrength: 1.0,
        patternBuilder: 'swoopingDive',
        create: () => new EntryPatternDirector(),
    },
    groupAttack: {
        stageName: 'Group Attack',
        fireRate: 1.4,
        missileStrength: 1.6,
        create: (config, formation) => {
            if (config.director !== 'groupAttack') throw new Error('Expected a groupAttack stage');
            return new GroupAttackPatternDirector(
                config.sets.map(([name, repeats, start]): [string, number, number] => [`${name}${formation}`, repeats, start]),
            );
        },
    },
    columnVertical: {
        stageName: 'Column Vertical',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new ColumnVerticalDirector(),
    },
    reverseColumnVertical: {
        stageName: 'Reverse Column Vertical',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new ReverseColumnVerticalDirector(),
    },
    columnDives: {
        stageName: 'Column Dives',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new ColumnDivesDirector(),
    },
    kamakaziDrops: {
        stageName: 'Kamakazi Drops',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new KamakaziDropsDirector(),
    },
    kamakaziDrops2: {
        stageName: 'Kamakazi Drops 2',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new KamakaziDropsDirector2(),
    },
    kamakaziDrops3: {
        stageName: 'Kamakazi Drops 3',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new KamakaziDropsDirector3(),
    },
    verticalRows: {
        stageName: 'Vertical Rows',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new VerticalRowsDirector(),
    },
    figureEight: {
        stageName: 'Figure Eight Again',
        fireRate: 1.2,
        missileStrength: 1.4,
        create: () => new FigureEightDirector(),
    },
    lazerB: {
        stageName: 'lazerBAttack',
        fireRate: 1.2,
        missileStrength: 1.4,
        create: () => new LazerBAttackPatternDirector(),
    },
    boss: {
        // PlaySession ends a boss wave when this stage completes, so the name matters (see onlyEntryStage).
        stageName: 'Boss',
        fireRate: 1.0,
        missileStrength: 1.0,
        create: (config) => {
            if (config.director !== 'boss') throw new Error('Expected a boss stage');
            return new BossDirector(config.bossId);
        },
    },
};

const FORMATIONS: Record<PatternType, () => IFormationDescriptor> = {
    Grid: () => makeGridFormation(10, 6, 12),
    V: () => makeVFormation(10, 6, 12),
    X: () => makeXFormation(10, 6, 12),
    Diamond: () => makeDiamondFormation(10, 6, 12),
};

/** Builds a fresh StageQueue (new formation and directors) from a wave's data. */
export function createWave(wave: IWaveConfig): StageQueue {
    const stages = wave.stages.map((config) => {
        const entry = DIRECTORS[config.director];

        // For entry patterns, pass the pattern builder type via context
        const directorContext = { orientation: 'front', ...config.context } as Record<string, any>;
        if ('patternBuilder' in entry && entry.patternBuilder) {
            directorContext.patternBuilder = entry.patternBuilder;
        }

        return new Stage(
            entry.stageName,
            entry.create(config, wave.formation),
            directorContext,
            config.fireRate ?? entry.fireRate,
            config.missileStrength ?? entry.missileStrength,
            null,
            config.weaponOverrides,
        );
    });
    return new StageQueue(stages, wave.loopStartIndex, FORMATIONS[wave.formation](), wave.roster, wave.terrain, wave.formationPattern);
}