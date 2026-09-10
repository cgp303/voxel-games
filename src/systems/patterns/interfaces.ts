// systems/patterns/interfaces.ts

import type { FormationController } from '../FormationController';
import type { EntityManager } from '../../entities/EntityManager';
import type { PlayField } from '../../world/PlayField';
import type { Object3D } from 'three';
import * as THREE from 'three';

/**
 * Generic context passed to ANY PatternDirector.
 * EntryPatternDirector, WavePatternDirector, BossEntranceDirector, etc.
 */
export interface DirectorContext {
    formation: FormationController;
    invaders: EntityManager;
    playField: PlayField;
    template: Object3D;

    /** Director-specific config (EntryConfig, WaveConfig, BossConfig, etc.) */
    config?: any;
}

/**
 * A single movement segment (Bezier, straight, loop, spiral, etc.)
 */
export interface PathSegment {
    samplePosition(t: number, out: THREE.Vector3): THREE.Vector3;
    sampleTangent(t: number, out: THREE.Vector3): THREE.Vector3;
}

/**
 * A full movement pattern composed of one or more segments.
 */
export interface PathPattern {
    duration: number;
    samplePosition(t: number, out: THREE.Vector3): THREE.Vector3;
    sampleTangent(t: number, out: THREE.Vector3): THREE.Vector3;
}

/**
 * A director controls spawning, timing, and assignment of patterns.
 */
export interface PatternDirector {
    begin(ctx: DirectorContext): void;
    update(dt: number): void;
    cancel(): void;

    isRunning(): boolean;
    isCancelled(): boolean;
    isComplete(): boolean;

    readonly queueRemaining: number;
}
