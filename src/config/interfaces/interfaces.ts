// systems/patterns/interfaces.ts

import type { FormationController } from '../../systems/FormationController';
import type { EntityManager } from '../../entities/EntityManager';
import type { Object3D, Vector3 } from 'three';
import * as THREE from 'three';
import type { MultiSegmentPattern } from '../../systems/patterns/patterns/MultiSegmentPattern';
import type { MovementPath, InvaderTypeId, EntrySide } from '../types/types';
import type { GameScene } from '../../scene/Scene';
import type { GameCamera } from '../../scene/Camera';
import type { GameRenderer } from '../../scene/Renderer';
import type { Input } from '../../core/Input';
import type { EventBus } from '../../core/EventBus';
import type { AssetManager } from '../../assets/AssetManager';
import type { PlayField } from '../../world/PlayField';
import type { Game } from '../../app/Game';
import type { ScreenManager } from '../../screens/ScreenManager';
import { StageQueue } from '../../systems/stages/StageQueue';

/**
 * Generic context passed to ANY PatternDirector.
 * EntryPatternDirector, WavePatternDirector, BossEntranceDirector, etc.
 */
export interface IDirectorContext {
    formation: FormationController;
    invaders: EntityManager | null;
    playField: PlayField;

    /** Director-specific config (EntryConfig, WaveConfig, BossConfig, etc.) */
    config?: any;
    scene?: THREE.Scene;
    assetKey?: string;
}

/**
 * A single movement segment (Bezier, straight, loop, spiral, etc.)
 */
export interface IPathSegment {
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
export interface IPathPattern {
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
export interface IPatternBuilder {
    build(origin: THREE.Vector3, side: number, duration: Vector3): MultiSegmentPattern;
    duration(): number;
}

/**
 * A director controls spawning, timing, and assignment of patterns.
 */
export interface IPatternDirector {
    begin(ctx: IDirectorContext): void;
    update(dt: number): void;
    cancel(): void;

    isRunning(): boolean;
    isCancelled(): boolean;
    isComplete(): boolean;

    readonly queueRemaining: number;
}

// Orientation configuration for invader movement and banking
export interface IOrientationConfig {
    bankGain: number;
    maxBankRad: number;
    orientSmooth: number;
    dockSmooth: number;
    debugForwardArrow: boolean;
}

export interface IScoreEntry {
    name: string;
    score: number;
    date?: string;
}



/**
 * Snapshot of entry tunables (usually spread from ENTRY constants).
 * Controllers may override per stage without mutating the const object.
 */
export interface IEntryConfig {
    invadersPerSecond: number;
    spawnMarginX: number;
    halfExtentX: number;
    bulgeDepth: number;
    bulgeSignZ: number;
    centerApproachX: number;
    pathDuration: number;
    spawnZBias: number;
    bankGain: number;
    maxBankRad: number;
    orientSmooth: number;
    dockSmooth: number;
    debugForwardArrow: boolean;
}

/** Grid cell in the invader formation */
export interface IFormationSlot {
    col: number;
    row: number;
}

/** Snapshot of formation layout tunables (usually spread from FORMATION). */
export interface IFormationConfig {
    cols: number;
    rows: number;
    spacing: number;
    originX: number;
    originZ: number;
    hoverY: number | null;
    hoverPadding: number;
    rootVelocityX: number;
    rootVelocityZ: number;
    formationDescription?: IFormationDescriptor | null;
}

// Formation layout descriptor for invader spawn patterns
export interface IFormationDescriptor {
    /** Map of "col,row" → world‑space offset { x, z } */
    map: Map<string, { x: number; z: number }>;

    /** Ordered list of lists of slot keys ("col,row") describing EXACT spawn order */
    spawnOrder: string[][];

    /**
     * How the director should consume spawnOrder:
     * - "LeftRightPairs": spawn two invaders per tick, left then right
     * - "Single": spawn one invader per tick
     * - "Wave": spawn rows or groups together
     * - "Custom": formation builder provides its own spawn logic
     */
    spawnType: "LeftRightPairs" | "Single" | "Wave" | "Custom";
    /** Maximum column index (cols - 1) */
    maxCol: number;
    /** Maximum row index (rows - 1) */
    maxRow: number;
}

export interface IStageCancelledPayload {
    reason: 'player_death' | 'manual' | 'dispose' | 'restart';
}

export interface IIntroStartedPayload {
    reason: 'start' | 'restart';
}

export interface IInvaderKilledPayload {
    id: number;
    typeId: string;
    scoreValue: number;
}


export interface IInvaderGroup {
    group: string[];
    path: MovementPath;
}


// invaders 
export interface IInvaderInitConfig {
    typeId?: InvaderTypeId;
    slot: IFormationSlot;
    side: EntrySide;
    spawn: Vector3;
    formation: FormationController;
    /** Path duration seconds; defaults to ENTRY.pathDuration */
    pathDuration?: number;
    scoreValue?: number;
    /** Bank / smoothing overrides */
    entry?: Partial<
        Pick<
            IEntryConfig,
            'bankGain' | 'maxBankRad' | 'orientSmooth' | 'dockSmooth' | 'debugForwardArrow'
        >
    >;
    pattern?: IPathPattern;
    poolAssetKey?: string;
}

/**
 * Shared dependencies injected into every screen on enter().
 */
export interface IGameContext {
    scene: GameScene;
    camera: GameCamera;
    renderer: GameRenderer;
    input: Input;
    events: EventBus;
    assets: AssetManager;
    game: Game;
    /** Shared play field (terrain + invaders), built at App start */
    playField: PlayField;
    /** Allows screens to request mode changes without importing App */
    screens: ScreenManager;
}

// screens ie. play screen demo screen etc.

/**
 * One active top-level mode (Demo or Play or Game Over).
 * High scores are an attract panel on Demo, not a separate screen.
 * Screens own mode-specific objects; shared core lives on GameContext.
 */
export interface IScreen {
    readonly id: string;

    /** Build / show content for this mode */
    enter(ctx: IGameContext): void | Promise<void>;

    /** Remove listeners and screen-owned meshes (not shared core) */
    exit(): void;

    /** Simulation + animation; dt in seconds */
    update(dt: number): void;

    /** Optional: react to viewport changes */
    resize?(width: number, height: number): void;
}

//for play session start options
export interface IPlaySessionStartOptions {
    /** Asset key for invader mesh template (default: 'invader'). */
    invaderAssetKey?: string;
    formation?: Partial<IFormationConfig>;
    stageQueue?: StageQueue;
}

// for cubicBezier.ts
export interface IBuildEntryControlsArgs {
    spawn: Vector3;
    /** Usually live formation home; may be updated later by caller */
    home: Vector3;
    centerX: number;
    /** Side the path starts from (determines center-approach sign) */
    sideSign: 1 | -1;
    bulgeDepth: number;
    bulgeSignZ: number;
    centerApproachX: number;
}

/** Cubic Bezier control polygon in world space. */
export interface ICubicBezierControls {
    p0: Vector3;
    p1: Vector3;
    p2: Vector3;
    p3: Vector3;
}


// Arguments passed to EntryPatternDirector.begin()
export interface EntryDirectorBeginArgs {
    formation: FormationController;
    invaders: EntityManager;
    playField: PlayField;
    /** Shared mesh template from AssetManager (cloned per invader). */
    template: Object3D;
    entry?: Partial<IEntryConfig>;
}


// voxels
// Voxel data structures for the voxel world
export interface IVoxel {
    x: number;
    y: number;
    z: number;
    colorIndex: number;
}

// Bounds of the voxel world, used for culling and spatial queries.
export interface IVoxelBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}


// vox parser
export interface IParsedVoxModel {
    size: { x: number; y: number; z: number };
    voxels: Array<{ x: number; y: number; z: number; colorIndex: number }>;
    colors: Array<{ r: number; g: number; b: number; a: number }>;
}

// Options for configuring the invader grid layout from PlayField.ts
export interface IInvaderGridOptions {
    cols?: number;
    rows?: number;
    /** World offset of grid center-ish origin used by legacy layout */
    originX?: number;
    originZ?: number;
    /** Height above terrain max (y) */
    hoverY?: number;
}

// Options for configuring the terrain generator from TerrainGenerator.ts
/**
 * Configuration for procedurally generated terrain
 * Can be serialized/stored and reused to generate consistent landscapes
 */
export interface IHeightColorBand {
    height: number; // 0-1, normalized height threshold
    color: { r: number; g: number; b: number };
}

export interface ITerrainConfig {
    // Dimensions
    width: number; // X dimension (columns)
    depth: number; // Z dimension (rows)
    maxHeight: number; // Y dimension (max voxel height, e.g., 32)
    tileSize: number; // Size of each terrain tile (for tiling noise)

    // Noise parameters
    noiseScale: number; // Frequency/zoom of noise (lower = more zoomed in, more variation)
    noiseOctaves: number; // Complexity layers (1-8 recommended)
    noisePersistence: number; // Amplitude falloff per octave (0.5 = half amplitude each time)
    noiseLacunarity: number; // Frequency multiplier per octave (2.0 = double frequency)
    noiseExponent: number; // Height curve (1.0 = linear, < 1.0 = flatter, > 1.0 = peaked)

    // Color mapping
    colorBands: IHeightColorBand[];

    // Seed for reproducibility
    seed: number;

    // Slope variation (adds color variation based on local slope)
    enableSlopeVariation: boolean;
    slopeColorShift: number; // How much slope affects color (0-0.3 recommended)
}


// Terrain build results for the voxel terrain service
export interface ITerrainBuildResult {
    mesh: THREE.Mesh;
    width: number;
    height: number;
    depth: number;
}

/** Two tiles abutted on Z for wrap-around scrolling */
export interface IScrollingTerrainBuildResult {
    meshA: THREE.Mesh;
    meshB: THREE.Mesh;
    width: number;
    height: number;
    /** Length of one tile along Z (wrap distance) */
    tileDepth: number;
}