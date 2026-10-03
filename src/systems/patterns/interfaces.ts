// systems/patterns/interfaces.ts

import type { FormationController } from '../FormationController';
import type { EntityManager } from '../../entities/EntityManager';
import type { PlayField } from '../../world/PlayField';
import type { Object3D } from 'three';
import * as THREE from 'three';
import type { MultiSegmentPattern } from './patterns/MultiSegmentPattern';

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
    scene?: THREE.Scene;
    assetKey?: string;
}

/**
 * A single movement segment (Bezier, straight, loop, spiral, etc.)
 */
export interface PathSegment {
    samplePosition(t: number, out: THREE.Vector3): THREE.Vector3;
    sampleTangent(t: number, out: THREE.Vector3): THREE.Vector3;
    sampleSpinRate(t: number): number;
    sampleTargetSpin(t: number): number;
    sampleOrientationSmoothing(): number;
    allowInversion: boolean;
}

/**
 * A full movement pattern composed of one or more segments.
 */
export interface PathPattern {
    duration: number;
    sampleSpinRate(t: number): number;
    samplePosition(t: number, out: THREE.Vector3): THREE.Vector3;
    sampleTangent(t: number, out: THREE.Vector3): THREE.Vector3;
    allowInversion(t: number): boolean;
    sampleTargetSpin(t: number): number;
    sampleOrientationSmoothing(t: number): number;
}

/**
 * Builds a side-aware (mirrored) movement pattern from a world-space origin.
 * Shared contract for every pattern builder used by InvaderRepathDirector subclasses.
 */
export interface PatternBuilder {
    build(origin: THREE.Vector3, side: number): MultiSegmentPattern;
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
