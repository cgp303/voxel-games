// systems/patterns/directors/KamakaziDropsDirector.ts

import { KamakaziDropsPatternBuilder } from '../patterns/invader-patterns/KamakaziDropsPatternBuilder';
import type { IPatternBuilder } from '../../../config/interfaces/interfaces';
import { slotKey } from '../formations/slotKey';
import { SlotKey, ColumnSpawnType } from '../../../config/types/types';
import { KamakaziDropsDirector } from './KamakaziDropsDirector';


export class KamakaziDropsDirector2 extends KamakaziDropsDirector {
    protected override msBetweenTriggers = 1;
    protected override batchSize = 2; // Number of slots per trigger batch
    protected override spawnType: ColumnSpawnType = 'Wave';
    protected override maxPicks = 6;

    protected createBuilder(): IPatternBuilder {
        return new KamakaziDropsPatternBuilder();
    }

}
