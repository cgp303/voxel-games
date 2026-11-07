// systems/patterns/directors/KamakaziDropsDirector.ts

import { KamakaziDropsPatternBuilder } from '../patterns/invader-patterns/KamakaziDropsPatternBuilder';
import type { IPatternBuilder } from '../../../config/interfaces/interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';
import { slotKey } from '../formations/slotKey';
import { SlotKey, ColumnSpawnType } from '../../../config/types/types';


export class KamakaziDropsDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.25;
    protected override spawnType: ColumnSpawnType = 'Wave';

    protected createBuilder(): IPatternBuilder {
        return new KamakaziDropsPatternBuilder();
    }

    /** Back-row-to-front, mirrored-column walk. Override for a different shape (e.g. FigureEight's row pairing). */
    /** Back-row-to-front, fixed random column order. */
    protected makeTriggerOrder(): SlotKey[][] {
        const order: SlotKey[][] = [];

        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;

        // Create a single random column order.
        const cols: number[] = [];
        for (let col = 0; col <= maxCol; col++) {
            cols.push(col);
        }

        // Fisher-Yates shuffle.
        for (let i = cols.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cols[i], cols[j]] = [cols[j], cols[i]];
        }

        // Walk rows from back to front.
        const batchSize = 3; // Number of slots per trigger batch

        for (let row = maxRow; row >= 0; row--) {
            const rowKeys = cols.map(col => slotKey(col, row));

            for (let i = 0; i < rowKeys.length; i += batchSize) {
                order.push(rowKeys.slice(i, i + batchSize));
            }
        }

        return order;
    }
}
