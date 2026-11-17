// systems/patterns/directors/ColumnVerticalDirector.ts

import { ColumnVerticalPatternBuilder2 } from '../patterns/invader-patterns/ColumnVerticalPatternBuilder2';
import type { IPatternBuilder } from '../../../config/interfaces/interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';
import type { ColumnSpawnType, SlotKey } from '../../../config/types/types';
import { slotKey } from '../formations/slotKey';

export class VerticalRowsDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.3;
    protected override spawnType: ColumnSpawnType = 'Wave';

    protected createBuilder(): IPatternBuilder {
        return new ColumnVerticalPatternBuilder2();
    }

    /** Back-row-to-front, mirrored-column walk. Override for a different shape (e.g. FigureEight's row pairing). */
    protected override makeTriggerOrder(): SlotKey[][] {
        const order: SlotKey[][] = [];
        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;
        const halfCol = maxCol / 2;


        // for (let colLeft = 0; colLeft <= halfCol; colLeft++) {
        //     const colRight = maxCol - colLeft;
        //     for (let rowBack = maxRow; rowBack >= 0; rowBack--) {
        //         order.push([slotKey(colLeft, rowBack), slotKey(colRight, rowBack)]);
        //     }
        // }

        for (let row = maxRow; row >= 0; row--) {
            const allColls: SlotKey[] = [];
            for (let col = 0; col <= maxCol; col++) {
                allColls.push(slotKey(col, row));

            }
            order.push(allColls);
        }

        return order;
    }
}
