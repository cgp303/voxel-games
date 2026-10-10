import type { ILevelDescriptor } from '../../config/interfaces/interfaces';
import type { InvaderRowRoster } from '../../config/types/types';
import { createBasicStages } from './stages-basic';
import {
    makeGridFormation,
    makeVFormation,
    makeDiamondFormation,
    makeStaggeredFormation,
    makeXFormation,
} from '../patterns/formations/formationBuilders';

// Row index 0 is nearest the player; the highest row is at the top of the screen.
const CLASSIC_ROSTER: InvaderRowRoster = ['scout', 'scout', 'fighter', 'fighter', 'elite', 'elite'];
const ELITE_HEAVY_ROSTER: InvaderRowRoster = ['scout', 'scout', 'scout', 'tie', 'tie', 'tie'];

/** Sample levels for testing the level system; wave count and formations vary on purpose. */
export function createBasicLevels(): ILevelDescriptor[] {
    return [
        {
            name: 'Level 1',
            waves: [
                () => createBasicStages(makeGridFormation(10, 6, 12), CLASSIC_ROSTER, "Grid"),
                () => createBasicStages(makeVFormation(10, 6, 12), CLASSIC_ROSTER, "V"),
                () => createBasicStages(makeDiamondFormation(10, 6, 12), CLASSIC_ROSTER, "Diamond"),
            ],
        },
        {
            name: 'Level 2',
            waves: [
                () => createBasicStages(makeDiamondFormation(10, 6, 12), ELITE_HEAVY_ROSTER, "Diamond"),
                () => createBasicStages(makeXFormation(10, 6, 12), ELITE_HEAVY_ROSTER, "X"),
            ],
        },
    ];
}
