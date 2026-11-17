// systems/patterns/directors/ColumnVerticalDirector.ts

import { ColumnVerticalPatternBuilder } from '../patterns/invader-patterns/ColumnVerticalPatternBuilder';
import type { IPatternBuilder } from '../../../config/interfaces/interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';
import { SlotKey } from '../../../config/types/types';
import { slotKey } from '../formations/slotKey';

export class ReverseColumnVerticalDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.175;

    protected createBuilder(): IPatternBuilder {
        return new ColumnVerticalPatternBuilder();
    }


    /** Back-row-to-front, mirrored-column walk. Override for a different shape (e.g. FigureEight's row pairing). */
    protected override makeTriggerOrder(): SlotKey[][] {
        const order: SlotKey[][] = [];
        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;
        const halfCol = Math.floor(maxCol / 2);
        for (let colLeft = halfCol; colLeft >= 0; colLeft--) {
            const colRight = maxCol - colLeft;
            for (let rowBack = maxRow; rowBack >= 0; rowBack--) {
                order.push([slotKey(colLeft, rowBack), slotKey(colRight, rowBack)]);
            }
        }
        return order;
    }


}


