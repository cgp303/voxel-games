import { Stage } from './Stage';
import { StageQueue } from './StageQueue';

import { EntryPatternDirector } from '../patterns/directors/EntryPatternDirector';
import { FigureEightDirector } from '../patterns/directors/FigureEightDirector';
import { ColumnDivesDirector } from '../patterns/directors/ColumnDivesDirector';

export function createBasicStages(): StageQueue {
    return new StageQueue(
        [
            new Stage(
                "Entry",
                EntryPatternDirector,
                { orientation: "front" },
                0.5,
                1.0
            ),

            new Stage(
                "Column Dives",
                ColumnDivesDirector,
                { orientation: "front" },
                1.0,
                1.2
            ),

            new Stage(
                "Figure Eight Again",
                FigureEightDirector,
                { orientation: "front" },
                1.2,
                1.4
            )
        ],
        1 // loopStartIndex
    );
}
