// systems/patterns/directors/ColumnVerticalDirector.ts

import { ColumnVerticalPatternBuilder } from '../patterns/ColumnVerticalPatternBuilder';
import type { IPatternBuilder } from '../../../config/interfaces/interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';

export class ColumnVerticalDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 0.3;

    protected createBuilder(): IPatternBuilder {
        return new ColumnVerticalPatternBuilder();
    }
}
