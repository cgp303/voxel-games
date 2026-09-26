import { Stage } from './Stage';
import { StageQueue } from './StageQueue';

import { EntryPatternDirector } from '../patterns/directors/EntryPatternDirector';
import { FigureEightDirector } from '../patterns/directors/FigureEightDirector';
import { ColumnDivesDirector } from '../patterns/directors/ColumnDivesDirector';
import { ColumnVerticalDirector } from '../patterns/directors/ColumnVerticalDirector';
import { makeGridFormation, makeVFormation, makeXFormation, makeDiamondFormation, makeCircleFormation, makeStaggeredFormation, makeThreeRingCircleFormation, makeSpiralFormation } from './formationBuilders';
import { GroupAttackPatternDirector } from '../patterns/directors/GroupAttackPatternDirector';

export function createBasicStages(): StageQueue {
    const formation = makeGridFormation(10, 6, 12);
    return new StageQueue(
        [
            new Stage(
                "Entry",
                new EntryPatternDirector(),
                { orientation: "front" },
                0.5,
                1.0
            ),



            // new Stage(
            //     "Group Attack",
            //     new GroupAttackPatternDirector([["groups2x2", 3, 1]]),
            //     { orientation: "front" },
            //     1.4,
            //     1.6
            // ),

            // new Stage(
            //     "Group Attack",
            //     new GroupAttackPatternDirector([["groupXs", 3, 0]]),
            //     { orientation: "front" },
            //     1.4,
            //     1.6
            // ),
            // new Stage(
            //     "Group Attack",
            //     new GroupAttackPatternDirector([["groupDiamonds", 3, 1]]),
            //     { orientation: "front" },
            //     1.4,
            //     1.6
            // ),

            // new Stage(
            //     "Group Attack",
            //     new GroupAttackPatternDirector([["groupCrosses", 3, 0]]),
            //     { orientation: "front" },
            //     1.4,
            //     1.6
            // ),

            // new Stage(
            //     "Figure Eight Again",
            //     new FigureEightDirector(),
            //     { orientation: "front" },
            //     1.2,
            //     1.4
            // ),

            // new Stage(
            //     "Column Dives",
            //     new ColumnDivesDirector(),
            //     { orientation: "front" },
            //     1.0,
            //     1.2
            // ),
            new Stage(
                "Column Vertical",
                new ColumnVerticalDirector(),
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
