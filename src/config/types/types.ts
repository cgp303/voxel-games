import { Time } from "../../core/Time";

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
    | "groups2x2"
    | "groups3x3"
    | "groupCrosses"
    | "groupXs"
    | "groupTs"
    | "groupDiamonds";

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