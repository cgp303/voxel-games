// systems/stages/StageQueue.ts

import { Stage } from './Stage';

export class StageQueue {
    stages: Stage[];
    index: number;
    loopStartIndex: number;

    constructor(stages: Stage[], loopStartIndex: number = 0) {
        this.stages = stages;
        this.index = 0;
        this.loopStartIndex = loopStartIndex;
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
