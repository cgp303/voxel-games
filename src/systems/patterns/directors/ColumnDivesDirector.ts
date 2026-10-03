// systems/patterns/directors/ColumnDivesDirector.ts

import { ColumnDivesPatternBuilder } from '../patterns/ColumnDivesPatternBuilder';
import type { PatternBuilder } from '../interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';

export class ColumnDivesDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.5;

    protected createBuilder(): PatternBuilder {
        return new ColumnDivesPatternBuilder();
    }
}
