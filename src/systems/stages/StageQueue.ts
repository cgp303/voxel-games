// systems/stages/StageQueue.ts

import { Stage } from './Stage';
import { FormationDescriptor } from '../../app/types';

export class StageQueue {
    stages: Stage[];
    index: number;
    loopStartIndex: number;
    formationDescription: FormationDescriptor | null;

    constructor(stages: Stage[], loopStartIndex: number = 0, formationDescription: FormationDescriptor) {
        this.stages = stages;
        this.index = 0;
        this.loopStartIndex = loopStartIndex;
        this.formationDescription = formationDescription;
    }

    getFormationDescription(): FormationDescriptor | null {
        return this.formationDescription;
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
