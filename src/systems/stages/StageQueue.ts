// systems/stages/StageQueue.ts

import { Stage } from './Stage';
import { IFormationDescriptor } from '../../config/interfaces/interfaces';
import type { InvaderRowRoster, InvaderTypeId } from '../../config/types/types';

export class StageQueue {
    stages: Stage[];
    index: number;
    loopStartIndex: number;
    formationDescription: IFormationDescriptor | null;
    rowRoster: InvaderRowRoster;

    constructor(
        stages: Stage[],
        loopStartIndex: number = 0,
        formationDescription: IFormationDescriptor,
        rowRoster: InvaderRowRoster
    ) {
        const rowCount = formationDescription.maxRow + 1;
        if (rowRoster.length !== rowCount) {
            throw new Error(
                `StageQueue: rowRoster has ${rowRoster.length} entries but the formation has ${rowCount} rows`
            );
        }

        this.stages = stages;
        this.index = 0;
        this.loopStartIndex = loopStartIndex;
        this.formationDescription = formationDescription;
        this.rowRoster = rowRoster;
    }

    getFormationDescription(): IFormationDescriptor | null {
        return this.formationDescription;
    }

    /** Invader type for a slot. Row-based for now; kept slot-addressed so per-slot rosters can replace it. */
    getTypeForSlot(_col: number, row: number): InvaderTypeId {
        return this.rowRoster[row];
    }

    numberOfStages(): number {
        return this.stages.length;
    }

    next(): Stage {
        const stage = this.stages[this.index];

        this.index++;

        if (this.index >= this.stages.length) {
            this.index = this.loopStartIndex;
        }

        return stage;
    }
}
