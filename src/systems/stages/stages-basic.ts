import { Stage } from './Stage';
import { StageQueue } from './StageQueue';

import { EntryPatternDirector } from '../patterns/directors/EntryPatternDirector';
import { FigureEightDirector } from '../patterns/directors/FigureEightDirector';
import { ColumnDivesDirector } from '../patterns/directors/ColumnDivesDirector';
import { makeGridFormation, makeVFormation, makeXFormation, makeDiamondFormation, makeCircleFormation, makeStaggeredFormation, makeThreeRingCircleFormation, makeSpiralFormation } from './formationBuilders';

export function createBasicStages(): StageQueue {
    const formation = makeXFormation(10, 8, 12);
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
                "Column Dives",
                new ColumnDivesDirector(),
                { orientation: "front" },
                1.0,
                1.2
            ),

            new Stage(
                "Figure Eight Again",
                new FigureEightDirector(),
                { orientation: "front" },
                1.2,
                1.4
            )
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
