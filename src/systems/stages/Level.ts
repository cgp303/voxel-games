// systems/stages/Level.ts

import type { ILevelDescriptor } from '../../config/interfaces/interfaces';
import type { StageQueue } from './StageQueue';

/**
 * Runtime cursor over a level's waves. Each wave is built from its factory
 * when requested, so every playthrough gets fresh StageQueue/director instances.
 */
export class Level {
    private readonly descriptor: ILevelDescriptor;
    private waveIndex = -1;

    constructor(descriptor: ILevelDescriptor) {
        if (descriptor.waves.length === 0) {
            throw new Error(`Level "${descriptor.name}" has no waves`);
        }
        this.descriptor = descriptor;
    }

    public get name(): string {
        return this.descriptor.name;
    }

    public get waveCount(): number {
        return this.descriptor.waves.length;
    }

    /** 0-based index of the wave most recently returned by nextWave(); -1 before the first. */
    public get currentWaveIndex(): number {
        return this.waveIndex;
    }

    /** Builds the next wave, or returns null once every wave has been played. */
    public nextWave(): StageQueue | null {
        if (this.waveIndex + 1 >= this.descriptor.waves.length) return null;
        this.waveIndex++;
        return this.descriptor.waves[this.waveIndex]();
    }
}
