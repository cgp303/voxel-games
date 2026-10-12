// systems/patterns/interfaces.ts

import type { FormationController } from '../../systems/FormationController';
import type { EntityManager } from '../../entities/EntityManager';
import type { Object3D, Vector3 } from 'three';
import * as THREE from 'three';
import type { MultiSegmentPattern } from '../../systems/patterns/patterns/MultiSegmentPattern';
import type { MovementPath, InvaderTypeId, EntrySide, AttackPatternId } from '../types/types';
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
import type { CollisionLayerFlag, ExplosionKind } from '../types/types';
import type { CollisionModelSet } from '../../systems/collision/CollisionModel.ts';
import type { HeightField } from '../../world/HeightField';


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
    /** Invader type for a formation slot (comes from the current StageQueue's row roster). */
    getInvaderTypeForSlot: (col: number, row: number) => InvaderTypeId;
}

/** Per-type invader data: which instanced mesh to use, score and durability. */
export interface IInvaderTypeDefinition {
    assetKey: string;
    scoreValue: number;
    hitPoints: number;
}

/** A level: an ordered list of waves; each factory builds a fresh StageQueue. */
export interface ILevelDescriptor {
    name: string;
    waves: Array<() => StageQueue>;
}

/** Where the session currently is in the level sequence (indices are 0-based). */
export interface ILevelProgress {
    levelIndex: number;
    levelName: string;
    waveIndex: number;
    waveCount: number;
}

export interface IWaveClearedPayload extends ILevelProgress {
    reason: 'skipped' | 'finished';
}

export interface ILevelCompletedPayload {
    levelIndex: number;
    levelName: string;
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
    /** Set by patterns that invader weapons may be restricted to. */
    readonly id?: AttackPatternId;
    /** Index of the path segment active at normalised time t (patterns without segments omit this). */
    getSegmentIndex?(t: number): number;
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
    formation?: Partial<IFormationConfig>;
    /** Single wave (Demo). Ignored when `levels` is provided. */
    stageQueue?: StageQueue;
    /** Ordered levels (Play); the session loops back to the first after the last. */
    levels?: ILevelDescriptor[];
    /** Spawn the player ship (Play only; Demo leaves this off). */
    spawnPlayer?: boolean;
}

/** Plain x/y/z offset (keeps config free of THREE objects). */
export interface IVector3Like {
    x: number;
    y: number;
    z: number;
}

/** Plain quaternion (THREE.Quaternion satisfies this). */
export interface IQuaternionLike {
    x: number;
    y: number;
    z: number;
    w: number;
}

/** Per-weapon tuning: visuals, pool size, fire rate and projectile travel. */
export interface IWeaponConfig {
    assetKey: string;
    maxCount: number;
    fireIntervalSec: number;
    speed: number;
    /** Z at which a flying shot starts fading out. */
    despawnZ: number;
    fadeDurationSec: number;
    muzzleOffset: IVector3Like;
    /** Yaw (radians) applied to the shot model so it faces the direction of travel. */
    modelRotationY: number;
    /** Whether shots of this weapon cast shadows (e.g. lasers no, bombs yes). */
    castShadow: boolean;
    /** Collision layer of the shots (who they can hit is set by COLLISION.rules). */
    collisionLayer: CollisionLayerFlag;
    /** World-unit radius added around the shot's path when testing against targets. */
    collisionRadius: number;
    /** Whether this weapon's shots can hit invader mines (default false). */
    destroysMines: boolean;
    /** Damage each shot does to an invader weapon's hit points (e.g. a laser with power 1 needs 3 hits for a 3 hp mine). */
    power: number;
}

/** Per-weapon tuning for weapons dropped or fired by invaders. */
export interface IInvaderWeaponConfig {
    assetKey: string;
    /** Pool size: the most of this weapon that can be live at once. */
    maxCount: number;
    /** Chance of a drop per frame at 60 fps while an invader is eligible (scaled by dt at other frame rates). */
    dropChancePerFrame: number;
    /** An invader only releases the weapon while its own X is within this world range, so drops bunch toward the middle. */
    releaseXRange: { min: number; max: number };
    /** Most of this weapon one invader can drop per attack; reset when it returns to the formation. */
    maxPerAttack: number;
    /** Invader types that can use this weapon. */
    allowedInvaderTypes: readonly InvaderTypeId[];
    /** Pattern id -> indices of the path segments during which the weapon may be used. */
    allowedSegments: Partial<Record<AttackPatternId, readonly number[]>>;
    /** World units past the player's back edge at which the weapon is recycled. */
    despawnMarginPastPlayer: number;
    /** Rotation about the weapon's local Z axis while it flies (radians per second; sign sets direction). */
    spinRateRadPerSec: number;
    /** Hits (by total player weapon power) needed to destroy it. */
    hitPoints: number;
    /** Extra distance (world units) a hit that does not destroy it pushes the weapon back, away from the player. */
    knockbackDistance: number;
    /** Initial speed of that push (units/s); it decelerates to zero over the distance, then the weapon resumes its course. */
    knockbackSpeed: number;
    /** World-unit radius used when the weapon sweeps against the player. */
    collisionRadius: number;
    castShadow: boolean;
}

/** Bloom tuning for the selective glow pass. */
export interface IBloomConfig {
    strength: number;
    radius: number;
    /** Scale of the bloom render target relative to the internal view size. */
    resolutionScale: number;
}

/** Optional visual effects. When `enabled` is false, no extra passes or materials are used. */
export interface IFxSettings {
    enabled: boolean;
    /** Object layer for meshes that should glow (all other meshes are excluded from bloom). */
    layer: number;
    /** Emissive multiplier for glowing shot materials. */
    shotEmissiveIntensity: number;
    bloom: IBloomConfig;
}

/** World-space movement limits for the player ship. */
export interface IPlayerBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    /** Fixed hover height. */
    y: number;
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
    /** Column heights of the terrain, for ground lookups (see IGroundSampler). */
    heightField: HeightField;
}

/** Two tiles abutted on Z for wrap-around scrolling */
export interface IScrollingTerrainBuildResult {
    meshA: THREE.Mesh;
    meshB: THREE.Mesh;
    width: number;
    height: number;
    /** Length of one tile along Z (wrap distance) */
    tileDepth: number;
    /** Column heights of one tile; both tiles are identical so this describes the whole belt. */
    heightField: HeightField;
}

/////////////ground and voxel data for effects
/** Slope of the ground: rise per world unit along X and Z. */
export interface IGradient2 {
    x: number;
    z: number;
}

/** World-space view of the terrain surface, accounting for where the (scrolling) ground currently is. */
export interface IGroundSampler {
    /** World Y of the terrain surface at world X/Z, or -Infinity where there is no ground. */
    getGroundHeight(x: number, z: number): number;
    /** Writes the surface slope at world X/Z into `out` (zero where there is no ground) and returns it. */
    getGroundGradient(x: number, z: number, out: IGradient2): IGradient2;
    /** World-space velocity of the ground along Z (0 when the terrain is not scrolling). */
    getGroundScrollVelocityZ(): number;
}

/**
 * A voxel model flattened for effects: one entry per voxel, positions relative to the model centre
 * (the same origin the instanced mesh uses) and the exact palette colour of that voxel.
 */
export interface IVoxelCloud {
    readonly count: number;
    /** Voxel centre offsets from the model centre, in voxel units (1 voxel = 1 world unit). */
    readonly x: Float32Array;
    readonly y: Float32Array;
    readonly z: Float32Array;
    /** Raw palette colour 0..1, exactly as the voxel mesh's vertex colours (no colour-space conversion). */
    readonly r: Float32Array;
    readonly g: Float32Array;
    readonly b: Float32Array;
}


/////////////sparks
/** Short-lived glowing single-voxel sparks thrown off by hits that do not destroy the target. */
export interface ISparkConfig {
    maxParticles: number;
    /** Edge length of one spark cube (world units; voxels are 1). */
    size: number;
    /** Sparks per hit, [min, max]. */
    count: readonly [number, number];
    /** Launch speed along the spark direction (units/s), [min, max]. */
    speed: readonly [number, number];
    /** World direction the sparks are thrown in, centred on the scatter cone (need not be normalised; +Y up, +Z away from the player). */
    direction: IVector3Like;
    /** Half-angle (radians) of the cone sparks are scattered in around the spark direction. */
    spread: number;
    /** Downward acceleration (units/s^2). */
    gravity: number;
    /** Lifetime (s), [min, max]. */
    life: readonly [number, number];
    /** Fraction of the emitting target's velocity the sparks inherit. */
    inheritVelocity: number;
    /** Starting colour multiplied by `hotIntensity` (above 1 drives the bloom). */
    hotColor: readonly [number, number, number];
    hotIntensity: number;
    /** Colour the spark cools to by `redAtFraction` of its life; it then dims and shrinks to nothing. */
    redColor: readonly [number, number, number];
    redAtFraction: number;
}

/////////////explosion debris
/** How one kind of explosion launches and lights its debris. Ranges are [min, max]. */
export interface IExplosionProfile {
    /** Outward launch speed away from the model centre (world units/s). */
    speed: readonly [number, number];
    /** Extra upward speed added to every particle (units/s). */
    upward: readonly [number, number];
    /** Maximum magnitude of an extra random velocity (units/s). */
    scatter: number;
    /** Fraction of the dying entity's own velocity the debris inherits. */
    inheritVelocity: number;
    /** Spin speed about a random axis fixed in the particle's own frame (rad/s). */
    spin: readonly [number, number];
    /** Debris lifetime including the shrink-out at the end (s). */
    life: readonly [number, number];
    /** Starts as `color * intensity` (intensity above 1 drives the bloom) and cools to the voxel's own colour. */
    glow: {
        color: readonly [number, number, number];
        intensity: number;
        durationSec: number;
    };
}

/** Debris physics and pool settings (see systems/fx). */
export interface IDebrisConfig {
    maxParticles: number;
    /** Downward acceleration (units/s^2). */
    gravity: number;
    /** Air drag: fraction of velocity lost per second (exponential). */
    airDrag: number;
    /** Bounciness: share of normal speed kept after an impact (0 = dead stop, 1 = perfect bounce). */
    restitution: number;
    /** Share of sliding speed (relative to the ground) lost in each impact. */
    bounceFriction: number;
    /** Sliding speed decay per second while touching the ground; this is what carries debris along with the scroll. */
    contactFriction: number;
    /** Spin kept after an impact (multiplier). */
    spinImpactDamping: number;
    /** Spin decay per second while touching the ground. */
    spinContactDamping: number;
    /** Impacts slower than this (units/s) do not bounce; the particle just rests/slides. */
    restSpeed: number;
    /** Edge length of one debris cube (world units; voxels are 1). */
    particleSize: number;
    /** Time over which debris shrinks away at the end of its life (s). */
    fadeSec: number;
    /** Particles that fall below this world Y (no ground under them) are removed. */
    killBelowY: number;
    /** Largest frame step the simulation will take (s); longer frames are clamped. */
    maxStepSec: number;
    profiles: Record<ExplosionKind, IExplosionProfile>;
}

/////////////collision
export interface ICollisionVoxel {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export interface ICollisionBakeOptions {
    /** Number of roll angles (about Z) baked over 360 degrees. */
    rollBuckets: number;
    /** Mask cells per world unit (1 voxel = 1 unit). */
    maskResolution: number;
}

/** Footprint of a model at one roll angle, collapsed along world Y onto the X/Z plane. */
export interface ICollisionBucket {
    /** Offsets from the entity origin to the mask grid's bounds (this is the bucket's AABB). */
    readonly minX: number;
    readonly minZ: number;
    readonly maxX: number;
    readonly maxZ: number;
    readonly cols: number;
    readonly rows: number;
    readonly cellsPerUnit: number;
    /** Row-major occupancy: data[row * cols + col] is 1 where the footprint is solid. */
    readonly data: Uint8Array;
}

export interface ISlabResult {
    tEnter: number;
    tExit: number;
}

export interface IMaskHit {
    /** Fraction (0..1) along the segment at which it enters the first solid cell. */
    t: number;
}

export interface IPoint3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** Something that sweeps through the world and tests against targets (shots, bombs). */
export interface ICollisionMover {
    readonly collisionLayer: CollisionLayerFlag;
    /** False while the mover is idle, fading or otherwise not collidable. */
    readonly collisionEnabled: boolean;
    /** World-unit radius the mover adds to a target's footprint. */
    readonly collisionRadius: number;
    /** When true every target along the path is hit; otherwise only the nearest one. */
    readonly collisionPierces?: boolean;
    readonly position: IPoint3;
    /** Position at the start of the frame; the swept path runs previous -> position. */
    readonly previousPosition: IPoint3;
}

/** Something a mover can hit (invaders, the player, shootable weapons). */
export interface ICollisionTarget {
    readonly collisionLayer: CollisionLayerFlag;
    readonly collisionEnabled: boolean;
    readonly collisionModels: CollisionModelSet | null;
    readonly position: IPoint3;
    /** Rotation about the Z (travel) axis in radians; selects the baked footprint. */
    getCollisionRoll(): number;
}

/** A mover layer collides with the target layers in `targets`. */
export interface ICollisionRule {
    mover: CollisionLayerFlag;
    targets: number;
    /** A pair is skipped when the Y distance between origins exceeds this. Y is never used otherwise. */
    yTolerance?: number;
}

export interface ICollisionGridBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface ICollisionSystemConfig {
    grid: ICollisionGridBounds & { cellSize: number };
    /** Layers tested directly, without the broadphase (for example the single player). */
    directLayers: number;
    rules: readonly ICollisionRule[];
}

export interface ICollisionHit {
    mover: ICollisionMover | null;
    target: ICollisionTarget | null;
    /** Fraction (0..1) along the mover's swept path where it first touches the target. */
    t: number;
    /** World-space hit point. */
    x: number;
    z: number;
    /** Hit point relative to the target origin, in the target's baked (rolled) frame. */
    localX: number;
    localZ: number;
    /** Roll bucket of the target's baked footprint that was hit. */
    bucket: number;
}