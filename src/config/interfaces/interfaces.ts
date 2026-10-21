// systems/patterns/interfaces.ts

import type { FormationController } from '../../systems/FormationController';
import type { EntityManager } from '../../entities/EntityManager';
import type { Object3D, Quaternion, Vector3 } from 'three';
import * as THREE from 'three';
import type { MultiSegmentPattern } from '../../systems/patterns/patterns/MultiSegmentPattern';
import type { MovementPath, InvaderTypeId, EntrySide, AttackPatternId, InvaderWeaponType, SlotKey, PooledWeaponKey } from '../types/types';
import type { GameScene } from '../../scene/Scene';
import type { GameCamera } from '../../scene/Camera';
import type { GameRenderer } from '../../scene/Renderer';
import type { Input } from '../../core/Input';
import type { EventBus } from '../../core/EventBus';
import type { AssetManager } from '../../assets/AssetManager';
import type { VoxelFont } from '../../systems/text/VoxelFont';
import type { PlayField } from '../../world/PlayField';
import type { Game } from '../../app/Game';
import type { ScreenManager } from '../../screens/ScreenManager';
import { StageQueue } from '../../systems/stages/StageQueue';
import type { BossCyclePhase, BossPartRole, BossWeaponType, CollisionLayerFlag, ExplosionKind } from '../types/types';
import type { Boss } from '../../entities/Boss';
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
    /** Creates the named boss in the session and returns it (set by PlaySession; used by the boss director). */
    spawnBoss?: (bossId: string) => Boss | null;
}

export interface IRepeatingPatternDirectorContext extends IDirectorContext {
    maxSetIterations?: number;
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
    /** Progress (0..1) through the segment active at normalised time t. */
    getSegmentProgress?(t: number): number;
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
    build(origin: THREE.Vector3, side: number, duration: number, path?: number): MultiSegmentPattern;
    duration(): number;
    overlap(): number;

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
    /** Map of slot key (see slotKey()) → world‑space offset { x, z } */
    map: Map<SlotKey, { x: number; z: number }>;

    /** Ordered list of lists of slot keys describing EXACT spawn order */
    spawnOrder: SlotKey[][];

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


/** A group attack as authored (and written by the group-attack-set tool): slot keys as "col,row" text. */
export interface IInvaderGroup {
    group: string[];
    path: MovementPath;
}

/** A group attack at runtime: the authored text converted once to numeric slot keys. */
export interface ISlotGroup {
    group: SlotKey[];
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

/** How a piece of voxel text looks. */
export interface IVoxelTextStyle {
    /** sRGB colour, e.g. 0x39ff14. */
    color: number;
    /** World units per voxel. */
    scale: number;
    /** Multiplier on the colour the text is drawn with on screen (1 = the full colour; lower is dimmer). */
    brightness: number;
    /**
     * Glow strength: scales the text colour in the bloom pass only, independently of `brightness`.
     * 1 blooms as brightly as the full colour; lower is subtler; 0 is no glow.
     */
    glowIntensity: number;
    /** Empty voxels between glyphs (default TEXT.letterGap). */
    letterGap?: number;
    /** Whether the text casts a shadow on the terrain (default true). */
    castShadow?: boolean;
}

/** A text display: what it says, how it looks, and where it floats relative to the (locked) camera. */
export interface ITextDisplay extends IVoxelTextStyle {
    text: string;
    /** How far in front of the camera the text floats (world units). */
    cameraDistance: number;
    /** Shift along the camera's right axis (world units; + is right). */
    offsetX: number;
    /** Shift along the camera's up axis (world units; + is up). */
    offsetY: number;
    /**
     * Tilt of the text in degrees. Leave undefined to face the camera squarely. A number stands the text
     * on the world instead: 0 is upright, 90 lies it flat face-up, both still reading left to right for the camera.
     */
    pitch?: number;
}

/** How the between-waves text moves: it zooms in along world Z from behind the camera, pauses, then flies off. */
export interface INextLevelFlyby {
    /** World Z of the pause. */
    pauseZ: number;
    /** The start is this far behind the camera in Z (world units). */
    startBehindCamera: number;
    /** World Z at which the text is removed. */
    endZ: number;
    approachSeconds: number;
    pauseSeconds: number;
    departSeconds: number;
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
    /** Voxel font for on-screen text; filled during the App's world bootstrap. */
    font: VoxelFont;
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

/**
 * One value for each entry of a weapon's allowedSegments: perSegment[patternId][i] belongs to
 * allowedSegments[patternId][i]. Every pattern id in allowedSegments needs an array of the same length.
 */
export type PerAllowedSegment<T> = Partial<Record<AttackPatternId, readonly T[]>>;

/** Settings shared by every invader weapon. */
export interface IInvaderWeaponBaseConfig {
    assetKey: string;
    /** Pool size: the most of this weapon that can be live at once. */
    maxCount: number;
    /** Invader types that can use this weapon. */
    allowedInvaderTypes: readonly InvaderTypeId[];
    /** Pattern id -> indices of the path segments during which the weapon may be used. */
    allowedSegments: Partial<Record<AttackPatternId, readonly number[]>>;
    /** World units past the player's back edge at which the weapon is recycled. */
    despawnMarginPastPlayer: number;
    /** World-unit radius used when the weapon sweeps against the player. */
    collisionRadius: number;
    castShadow: boolean;
    /**
     * Per allowed segment: chance per frame at 60 fps (scaled by dt at other frame rates) that an eligible
     * invader releases the weapon. 1 = always release at the first opportunity; lower values make the release time random.
     */
    dropChancePerFrame: PerAllowedSegment<number>;
}

/** A mine: dropped at random, drifts toward the player and can be shot to pieces. */
export interface IMineWeaponConfig extends IInvaderWeaponBaseConfig {
    kind: 'mine';
    /** An invader only releases the weapon while its own X is within this world range, so drops bunch toward the middle. */
    releaseXRange: { min: number; max: number };
    /** Most of this weapon one invader can drop per attack; reset when it returns to the formation. */
    maxPerAttack: number;
    /** Rotation about the weapon's local Z axis while it flies (radians per second; sign sets direction). */
    spinRateRadPerSec: number;
    /** Hits (by total player weapon power) needed to destroy it. */
    hitPoints: number;
    /** Extra distance (world units) a hit that does not destroy it pushes the weapon back, away from the player. */
    knockbackDistance: number;
    /** Initial speed of that push (units/s); it decelerates to zero over the distance, then the weapon resumes its course. */
    knockbackSpeed: number;
    /** Initial velocity of the weapon when released. */
    velocity: Vector3;
    /** Asset keys of damaged models: after the nth hit that does not destroy the weapon it shows hitMeshes[n - 1]. Each must be in INSTANCED_ASSETS. */
    hitMeshes?: readonly string[];
}

/** How a lazer is aimed when released. */
export type LazerAimConfig =
    /** Flies the way the invader is travelling, with the invader's orientation. */
    | {
        mode: 'inheritHeading';
        /** Lazers released per attack. */
        shots: number;
        /** Pause between consecutive shots (seconds). */
        intervalSec: number;
    }
    /** The invader yaws to face the player, fires one lazer along that line, then yaws back to its path orientation. */
    | {
        mode: 'atPlayer';
        /** Seconds to turn from the path heading to face the player. */
        turnInSec: number;
        /** Longest (seconds) to wait, once fully turned, for the model to settle on the player before giving up without firing. */
        faceTimeoutSec: number;
        /** Seconds the invader holds the aim after firing. */
        holdSec: number;
        /** Seconds to turn back to the path heading. */
        turnOutSec: number;
        /** The invader counts as facing the player within this angle (radians). */
        facingToleranceRad: number;
        /** Random error added to the lazer's direction: it leaves within a cone of this half-angle (radians) around the line to the player. 0 = perfect aim. */
        aimNoiseRad: number;
        /** Where to aim when there is no player at all (e.g. the demo). A player who is merely respawning does not count. */
        noPlayerTarget: IVector3Like;
    };

/** An invader lazer: indestructible, flies in a straight line at a fixed speed. */
export interface ILazerWeaponConfig extends IInvaderWeaponBaseConfig {
    kind: 'lazer';
    /** Per allowed segment: flight speed (world units per second). */
    speed: PerAllowedSegment<number>;
    aim: LazerAimConfig;
    /** Per allowed segment: progress (0..1) through the segment at which releasing (or turning to aim) starts. */
    segmentProgress: PerAllowedSegment<number>;
    /** Puts the lazers on the bloom layer, like the player's shots. */
    glow: boolean;
}

/** Per-weapon tuning for weapons dropped or fired by invaders. */
export type IInvaderWeaponConfig = IMineWeaponConfig | ILazerWeaponConfig;

/**
 * Settings a stage can replace for one weapon type; anything left out keeps the INVADER_WEAPONS value.
 * Per-segment tables use the same shape as the config: a pattern id may be left out, but one that is given needs
 * one value per entry of that pattern's allowedSegments.
 */
export interface IInvaderWeaponOverrideBase {
    dropChancePerFrame?: PerAllowedSegment<number>;
}

export interface IMineWeaponOverride extends IInvaderWeaponOverrideBase {
    maxPerAttack?: number;
}

export interface ILazerWeaponOverride extends IInvaderWeaponOverrideBase { }

/** Per-stage weapon tuning, set on a Stage so every director gets it. */
export interface IWeaponOverrides {
    Mine?: IMineWeaponOverride;
    LazerA?: ILazerWeaponOverride;
    LazerB?: ILazerWeaponOverride;
}

/** The override of one weapon type, as handed to its trigger. */
export type IInvaderWeaponOverride = NonNullable<IWeaponOverrides[InvaderWeaponType]>;

/** World limits that end a lazer's flight sideways or toward +Z (the -Z limit is the weapon's despawnZ). */
export interface ILazerDespawnBounds {
    minX: number;
    maxX: number;
    maxZ: number;
}

/** Where and how a weapon leaves its invader; filled by a WeaponTrigger and reused every frame. */
export interface IWeaponLaunch {
    origin: Vector3;
    velocity: Vector3;
    orientation: Quaternion;
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

/** Per-particle output a DebrisRenderer draws: positions, orientation, edge length and colour (first `count` entries). */
export interface IParticleBuffers {
    readonly count: number;
    readonly px: Float32Array;
    readonly py: Float32Array;
    readonly pz: Float32Array;
    readonly qx: Float32Array;
    readonly qy: Float32Array;
    readonly qz: Float32Array;
    readonly qw: Float32Array;
    readonly size: Float32Array;
    readonly cr: Float32Array;
    readonly cg: Float32Array;
    readonly cb: Float32Array;
}

/** Voxels swooping in from off-screen to build a piece of voxel text (see systems/text/VoxelAssembler). */
export interface IVoxelAssemblyConfig {
    /** Seconds from the start until the last voxel lands. */
    assembleSeconds: number;
    /** Flight time of one voxel (s); each voxel gets a random share of 70-100% of this and a random start delay. */
    travelSeconds: number;
    /** Distance range (world units) from the text centre at which voxels start; they come from the upper hemisphere. */
    spawnRadius: readonly [number, number];
    /** Lowest start elevation above the text's horizontal plane (degrees), so no voxel starts below it. */
    minElevationDeg: number;
    /** How far a path bows sideways, as a fraction of its length. */
    curve: number;
    /** Tumbles a voxel makes before settling. */
    spinTurns: number;
    /** Seconds a landed voxel's flash takes to fade. */
    flashSeconds: number;
    /** Light added to the voxel's colour at the moment it lands (above 1 blooms). */
    flashIntensity: number;
}


/////////////bosses
/** A weapon release the boss wants made this frame. The session spawns it and the boss reuses the slot. */
export interface IBossLaunch {
    key: PooledWeaponKey;
    weapon: BossWeaponType;
    origin: THREE.Vector3;
    velocity: THREE.Vector3;
    orientation: THREE.Quaternion;
}

export interface IBossInit {
    definition: IBossDefinition;
    voxels: readonly IVoxel[];
    palette: Array<{ r: number; g: number; b: number; a: number }>;
    /** World Y the boss holds. */
    hoverY: number;
    /** The looping path it flies once it has entered; it starts at the path's start. */
    path: IPathPattern;
    /** Pool bucket of each weapon, by weapon id. */
    weaponKeys: Readonly<Record<string, PooledWeaponKey>>;
}
/**
 * Inclusive rectangle of voxel columns in the boss's model space: [x0, z0, x1, z1]. Model space is the .vox
 * with its axes swapped like the font's (file z, the height in MagicaVoxel, becomes y), so x and z span the
 * top-down footprint and the boss's front, the end nearest the player, is z = 0.
 */
export type BossRect = readonly [number, number, number, number];

/** A hittable part: every voxel column inside its rectangles (all heights) is destroyed together once `hits` are spent. */
export interface IBossPartDef {
    id: string;
    rects: readonly BossRect[];
    /** Hits (total player weapon power) needed to destroy the part. */
    hits: number;
    role?: BossPartRole;
}

/** Voxel columns no part claims are split into tiles of this size (connected pieces within a tile), each its own part. */
export interface IBossHullDef {
    tile: { w: number; d: number };
    hits: number;
}

/** One place a weapon is released from. The mount stops working as soon as any part in `disabledBy` is destroyed. */
export interface IBossMountDef {
    /** Release point in voxel coordinates of the model (x, y = height, z); the centre of that voxel is used. */
    muzzle: IVector3Like;
    disabledBy: readonly string[];
}

export interface IBossWeaponDef {
    id: string;
    /** Which entry of BOSS_WEAPONS gives the weapon its behaviour. */
    weapon: BossWeaponType;
    /** Name of the weapon's .vox, without extension, in the boss's folder. */
    asset: string;
    /** When true every working mount releases together; otherwise the mounts take turns. */
    sync?: boolean;
    /** Seconds between releases. */
    rate: number;
    /** Release speed (units/s); defaults to the weapon's own setting. */
    speed?: number;
    /** Phases of the boss's cycle in which the weapon fires. */
    phases: readonly BossCyclePhase[];
    mounts: readonly IBossMountDef[];
}

/** One step of the attack/rest cycle; its length is random within `seconds`. */
export interface IBossCycleStep {
    phase: BossCyclePhase;
    seconds: readonly [number, number];
}

export interface IBossMovementDef {
    /** Key of BOSS_PATHS. */
    path: string;
    /** Seconds to fly the whole (looping) path. */
    durationSec: number;
    /** Largest roll (radians) the boss leans by. The boss never yaws: it always faces the player. */
    maxRollRad: number;
    /** Roll (radians) per unit of sideways speed. */
    rollGain: number;
}

export interface IBossFxDef {
    /** Chunks cut off from the anchor fall away. */
    chunks: boolean;
    /** Damaged edges drip fire. */
    drip: boolean;
}

/** A boss as described by its JSON file (see public/assets/vox/bosses). */
export interface IBossDefinition {
    id: string;
    /** Path of the boss's .vox, relative to the site root. */
    vox: string;
    /** Model-space size in voxels (x, y = height, z); checked against the .vox. */
    size: IVector3Like;
    scoreValue: number;
    hull: IBossHullDef;
    parts: readonly IBossPartDef[];
    weapons: readonly IBossWeaponDef[];
    cycle: readonly IBossCycleStep[];
    movement: IBossMovementDef;
    fx: IBossFxDef;
}

/** A loaded boss: its definition, and the asset keys its models were registered under. */
export interface IBossResources {
    definition: IBossDefinition;
    /** AssetManager key of the boss's model (already in model space). */
    modelKey: string;
    /** AssetManager key of each weapon's model, by weapon id. */
    weaponModelKeys: Readonly<Record<string, string>>;
}

/** Settings every boss weapon shares. */
export interface IBossWeaponBaseConfig {
    /** Pool size: the most of this weapon that can be live at once. */
    maxCount: number;
    /** World-unit radius used when the weapon sweeps against the player. */
    collisionRadius: number;
    castShadow: boolean;
    /** Puts the weapon on the bloom layer. */
    glow: boolean;
    /** World units past the player's back edge at which the weapon is recycled. */
    despawnMarginPastPlayer: number;
    /** Speed used when the boss definition does not give one (units/s). */
    defaultSpeed: number;
}

/** A boss lazer: indestructible and straight, like an invader's. */
export interface IBossLazerConfig extends IBossWeaponBaseConfig {
    kind: 'lazer';
}

/**
 * A boss missile. `bezier` flies a curve that ends where the player was when it was released; `homing` steers
 * toward the player's current position at a limited turn rate; `bezierThenHoming` does the first, then the second.
 * It can be shot like a mine.
 */
export interface IBossMissileConfig extends IBossWeaponBaseConfig {
    kind: 'missile';
    guidance: 'bezier' | 'homing' | 'bezierThenHoming';
    /** How far the curve bows sideways, as a fraction of its length (0 = a straight line). */
    bezierBow: number;
    /** Fastest the homing steering can turn the missile (radians per second). */
    turnRateRadPerSec: number;
    /** Seconds before an unspent missile gives up and is recycled. */
    maxLifeSec: number;
    /** Hits (total player weapon power) needed to destroy it. */
    hitPoints: number;
    /** Rotation about its own Z axis while it flies (radians per second). */
    spinRateRadPerSec: number;
}

export type IBossWeaponConfig = IBossLazerConfig | IBossMissileConfig;


/** A looping path the boss flies; consecutive segments share end points, and the last ends where the first starts. */
export interface IBossPathDef {
    segments: ICubicBezierControls[];
}

/** Boss behaviour that is not specific to one boss. */
export interface IBossSettings {
    /** Folder under the site root that holds each boss's own folder (`<folder>/<id>/<id>.json`). */
    assetFolder: string;
    /** Boss ids to load at start-up. */
    ids: readonly string[];
    /** Height above the terrain. */
    hoverPadding: number;
    /** World Z the boss starts its entrance from (off the far edge of the screen). */
    entranceZ: number;
    entranceSeconds: number;
    /** How quickly the roll follows its target (per second). */
    rollSmooth: number;
    /** The player is killed when within this radius (world units) of a solid boss voxel. */
    contactRadius: number;
    /** Seconds between drips at no damage and at full damage (it speeds up as parts are lost). */
    dripIntervalSec: readonly [number, number];
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

/** Where a collision model's footprints for one mover radius live: one bucket per roll angle. */
export interface ICollisionModelVariant {
    readonly buckets: readonly ICollisionBucket[];
    bucketIndexForRoll(roll: number): number;
}

/** What the collision system needs from a target's baked footprints (CollisionModelSet, or a boss's editable mask). */
export interface ICollisionModelSource {
    /** Roll-independent half extents (origin to farthest edge) used by the broadphase. */
    readonly broadHalfX: number;
    readonly broadHalfZ: number;
    /** Footprints for movers of the given radius (world units). */
    get(radius: number): ICollisionModelVariant;
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
    readonly collisionModels: ICollisionModelSource | null;
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