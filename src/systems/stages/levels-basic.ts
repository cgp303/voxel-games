import type { ILevelDescriptor } from '../../config/interfaces/interfaces';
import type { InvaderRowRoster } from '../../config/types/types';
import { createBasicStages } from './levels/stages-basic';
import { createLevel1_1 } from './levels/level1_1';
import { createLevel1_2 } from './levels/level1_2';
import { createLevel1_3 } from './levels/level1_3';
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
const TIE_BOMBERS: InvaderRowRoster = ['tie', 'tie', 'tie', 'tie', 'tie', 'tie'];
const FIGHTER_BOMBERS: InvaderRowRoster = ['fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'];
const ELITES_ROSTER: InvaderRowRoster = ['elite', 'elite', 'elite', 'elite', 'elite', 'elite'];

/** Sample levels for testing the level system; wave count and formations vary on purpose. */
export function createBasicLevels(): ILevelDescriptor[] {
    return [
        {
            name: 'Level 1',
            waves: [
                () => createLevel1_3(makeDiamondFormation(10, 6, 12), ELITES_ROSTER, "Diamond"),
                () => createLevel1_1(makeGridFormation(10, 6, 12), TIE_BOMBERS, "Grid"),
                () => createLevel1_2(makeXFormation(10, 6, 12), FIGHTER_BOMBERS, "X"),

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
