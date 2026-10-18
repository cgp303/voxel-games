// systems/stages/WaveFactory.ts

import { Stage } from './Stage';
import { StageQueue } from './StageQueue';
import { EntryPatternDirector } from '../patterns/directors/EntryPatternDirector';
import { GroupAttackPatternDirector } from '../patterns/directors/GroupAttackPatternDirector';
import { ColumnVerticalDirector } from '../patterns/directors/ColumnVerticalDirector';
import { ColumnDivesDirector } from '../patterns/directors/ColumnDivesDirector';
import { FigureEightDirector } from '../patterns/directors/FigureEightDirector';
import { LazerBAttackPatternDirector } from '../patterns/directors/LazerBAttackPatternDirector';
import {
    makeGridFormation,
    makeVFormation,
    makeXFormation,
    makeDiamondFormation,
} from '../patterns/formations/formationBuilders';
import type { IFormationDescriptor, IPatternDirector, IWeaponOverrides } from '../../config/interfaces/interfaces';
import type { GroupKind, InvaderRowRoster, PatternType } from '../../config/types/types';

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
    | IStageBase<'entry' | 'columnVertical' | 'columnDives' | 'figureEight' | 'lazerB'>
    | (IStageBase<'groupAttack'> & {
          /** `[patternName, repeats, startIndex]`; the wave's formation (`Grid`, `X`, ...) is appended to the name. */
          sets: [GroupKind, number, number][];
      });

type IStageBase<D extends string> = IStageConfigBase & { director: D };

/** A wave as plain data: formation, who sits in each row, and the ordered stages. */
export interface IWaveConfig {
    formation: PatternType;
    /** Row 0 is nearest the player. Must have one entry per formation row. */
    roster: InvaderRowRoster;
    stages: IStageConfig[];
    /** Stage index the queue returns to after the last stage. */
    loopStartIndex: number;
}

type DirectorKey = IStageConfig['director'];

interface IDirectorEntry {
    stageName: string;
    fireRate: number;
    missileStrength: number;
    create: (config: IStageConfig, formation: PatternType) => IPatternDirector;
}

/** Directors are stateful, so each wave build creates fresh ones. Defaults are the usual rates for each. */
const DIRECTORS: Record<DirectorKey, IDirectorEntry> = {
    entry: {
        stageName: 'Entry',
        fireRate: 0.5,
        missileStrength: 1.0,
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
    columnDives: {
        stageName: 'Column Dives',
        fireRate: 1.0,
        missileStrength: 1.2,
        create: () => new ColumnDivesDirector(),
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
        return new Stage(
            entry.stageName,
            entry.create(config, wave.formation),
            { orientation: 'front', ...config.context },
            config.fireRate ?? entry.fireRate,
            config.missileStrength ?? entry.missileStrength,
            null,
            config.weaponOverrides,
        );
    });
    return new StageQueue(stages, wave.loopStartIndex, FORMATIONS[wave.formation](), wave.roster);
}
