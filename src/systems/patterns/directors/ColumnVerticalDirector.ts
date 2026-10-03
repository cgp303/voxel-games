// systems/patterns/directors/ColumnVerticalDirector.ts

import { ColumnVerticalPatternBuilder } from '../patterns/ColumnVerticalPatternBuilder';
import type { PatternBuilder } from '../interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';

export class ColumnVerticalDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.3;

    protected createBuilder(): PatternBuilder {
        return new ColumnVerticalPatternBuilder();
    }
}
