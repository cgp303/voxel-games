// systems/patterns/directors/FigureEightDirector.ts

import { FigureEightPatternBuilder } from '../patterns/invader-patterns/FigureEightPatternBuilder';
import type { IPatternBuilder } from '../../../config/interfaces/interfaces';
import type { SlotKey } from '../../../config/types/types';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';
import { slotKey } from '../formations/slotKey';

export class FigureEightDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.25;

    protected createBuilder(): IPatternBuilder {
        return new FigureEightPatternBuilder();
    }

    /** Pairs each column with its mirrored column one row back, instead of a fixed back-to-front column sweep. */
    protected override makeTriggerOrder(): SlotKey[][] {
        const order: SlotKey[][] = [];
        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;

        for (let row = maxRow; row >= 0; row -= 2) {
            for (let col = 0; col <= maxCol; col++) {
                const colRight = maxCol - col;
                order.push([slotKey(col, row), slotKey(colRight, row - 1)]);
            }
        }
        return order;
    }
}
