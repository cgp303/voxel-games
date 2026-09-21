import { Stage } from './Stage';
import { StageQueue } from './StageQueue';

import { EntryPatternDirector } from '../patterns/directors/EntryPatternDirector';
import { FigureEightDirector } from '../patterns/directors/FigureEightDirector';
import { ColumnDivesDirector } from '../patterns/directors/ColumnDivesDirector';
import { makeGridFormation, makeVFormation, makeXFormation, makeDiamondFormation, makeCircleFormation, makeStaggeredFormation, makeThreeRingCircleFormation, makeSpiralFormation } from './formationBuilders';
import { GroupAttackPatternDirector } from '../patterns/directors/GroupAttackPatternDirector';

export function createBasicStages(): StageQueue {
    const formation = makeVFormation(10, 6, 12);
    return new StageQueue(
        [
            new Stage(
                "Entry",
                new EntryPatternDirector(),
                { orientation: "front" },
                0.5,
                1.0
            ),



            new Stage(
                "Group Attack",
                new GroupAttackPatternDirector([["groups2x2", 3], ["groupXs", 3], ["groupCrosses", 3], ["groupTs", 3], ["groupDiamonds", 3]]),
                { orientation: "front" },
                1.4,
                1.6
            ),

            new Stage(
                "Figure Eight Again",
                new FigureEightDirector(),
                { orientation: "front" },
                1.2,
                1.4
            ),

            new Stage(
                "Column Dives",
                new ColumnDivesDirector(),
                { orientation: "front" },
                1.0,
                1.2
            ),
        ],
        1, // loopStartIndex
        formation
    );
}

export function createDemoStages(): StageQueue {
    const formation = makeVFormation(10, 6, 12);
    return new StageQueue(
        [
            new Stage(
                "Entry",
                new EntryPatternDirector(),
                { orientation: "front" },
                0.5,
                1.0
            ),
        ],
        1, // loopStartIndex
        formation
    );
}
