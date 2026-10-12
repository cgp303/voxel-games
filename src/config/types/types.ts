import type { Time } from "../../core/Time";

/** High-level game mode / screen identity (high scores live inside demo attract) */
export type GameMode = 'demo' | 'play' | 'game_over';



/** Which wing an entry path starts from */
export type EntrySide = 'left' | 'right' | 'center';

// invader path position.
export type MovementPath = "left" | "right" | "center";

// for ColumnTriggerDirector.ts
export type ColumnSpawnType = 'LeftRightPairs' | 'Single' | 'Wave';

/**
 * Invader behaviour FSM.
 * v1 uses entering → formation; other modes are reserved.
 */
export type InvaderMode =
    | 'inactive'
    | 'entering'
    | 'formation'
    | 'diving'
    | 'returning'
    | 'hit'
    | 'dying';

/** Invader archetype key (mesh / score tables live in INVADER_TYPES) */
export type InvaderTypeId = 'scout' | 'fighter' | 'elite' | 'tie';

/**
 * Invader type per formation row; index = row number in the formation.
 * The highest row is furthest from the player (top of screen).
 */
export type InvaderRowRoster = InvaderTypeId[];



/**
 * Play-session lifecycle / combat events (string keys on EventBus for now).
 * Prefer these constants over raw strings at emit/on call sites.
 */
export const GameEvents = {
    /** Entry queue cancelled (player death, forced stop). In-flight may still exist. */
    stageCancelled: 'stage:cancelled',
    /** Full intro boot (start / restartIntro). */
    introStarted: 'intro:started',
    /** Entry queue empty and no invader still entering. */
    entryComplete: 'entry:complete',
    /** Future: invader killed — payload includes scoreValue. */
    invaderKilled: 'invader:killed',
    /** Future: player lost a life / died. */
    playerDied: 'player:died',
    /** A wave (StageQueue) began; payload is ILevelProgress. */
    waveStarted: 'wave:started',
    /** A wave was left (skipped or finished); payload is IWaveClearedPayload. */
    waveCleared: 'wave:cleared',
    /** A level began (its first wave is about to start); payload is ILevelProgress. */
    levelStarted: 'level:started',
    /** Last wave of a level ended; payload is ILevelCompletedPayload. */
    levelCompleted: 'level:completed',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];

// invader group formation types.
export type GroupType =
    // Grid formations
    | "group2x2Grid"
    | "group3x3Grid"
    | "groupCrossesGrid"
    | "groupXsGrid"
    | "groupTsGrid"
    | "groupDiamondsGrid"
    // V formations
    | "group2x2V"
    | "group3x3V"
    | "groupCrossesV"
    | "groupXsV"
    | "groupTsV"
    | "groupDiamondsV"
    // Diamond formations
    | "group2x2Diamond"
    | "group3x3Diamond"
    | "groupCrossesDiamond"
    | "groupXsDiamond"
    | "groupTsDiamond"
    | "groupDiamondsDiamond"
    // X formations
    | "group2x2X"
    | "group3x3X"
    | "groupCrossesX"
    | "groupXsX"
    | "groupTsX"
    | "groupDiamondsX"
    ;

// for formationBuilders.ts
export type SlotOffset = { x: number; z: number };
export type SlotMap = Map<string, SlotOffset>;

// for engine.ts
export type EngineTick = (time: Time) => void;

// for viewport.ts
export type FitRect = {
    width: number;
    height: number;
    left: number;
    top: number;
};

// demoscreen 
export type DemoAttractPanel = 'info' | 'highscores';

export type PatternType = "Grid" | "V" | "X" | "Diamond";

// weapons and projectiles
/** Weapon kinds; add Missile, SmartBomb etc. when implemented. */
export type WeaponType = 'Laser';

/** Weapons carried by invaders (each type has its own pool bucket and instanced mesh). */
export type InvaderWeaponType = 'Mine';

/** Identifies an invader attack pattern so weapons can be limited to specific patterns. */
export type AttackPatternId = 'groupAttack1' | 'groupAttack2';

/** Pooled projectile lifecycle: Idle (hidden in pool), Flying, Fading (shrinking before release). */
export type ProjectileState = 'Idle' | 'Flying' | 'Fading';

// explosions
/** What exploded; selects the debris profile in EXPLOSION.profiles. */
export type ExplosionKind = 'invader' | 'player';

// collision
/**
 * One bit per collision layer. An entity belongs to exactly one layer;
 * rules (see COLLISION in constants) combine layers into masks.
 */
export const CollisionLayer = {
    PLAYER: 1 << 0,
    PLAYER_MISSILE: 1 << 1,
    INVADER: 1 << 2,
    INVADER_WEAPON: 1 << 3,
    /** Invader weapons that player missiles can destroy. */
    INVADER_WEAPON_SHOOTABLE: 1 << 4,
} as const;

/** A single layer bit. Masks (several layers OR-ed together) are plain numbers. */
export type CollisionLayerFlag = (typeof CollisionLayer)[keyof typeof CollisionLayer];