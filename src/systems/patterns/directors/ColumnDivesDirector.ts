// systems/patterns/directors/ColumnDivesDirector.ts

import { ColumnDivesPatternBuilder } from '../patterns/invader-patterns/ColumnDivesPatternBuilder';
import type { IPatternBuilder } from '../../../config/interfaces/interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';

export class ColumnDivesDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.5;

    protected createBuilder(): IPatternBuilder {
        return new ColumnDivesPatternBuilder();
    }
}
