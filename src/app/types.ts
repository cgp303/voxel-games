/** High-level game mode / screen identity (high scores live inside demo attract) */
export type GameMode = 'demo' | 'play' | 'game_over';

export interface ScoreEntry {
    name: string;
    score: number;
    date?: string;
}

/** Grid cell in the invader formation */
export interface FormationSlot {
    col: number;
    row: number;
}

/** Which wing an entry path starts from */
export type EntrySide = 'left' | 'right';

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

/** Invader archetype key (mesh / score tables later) */
export type InvaderTypeId = 'grunt' | 'elite' | 'boss';

/**
 * Snapshot of entry tunables (usually spread from ENTRY constants).
 * Controllers may override per stage without mutating the const object.
 */
export interface EntryConfig {
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

/** Snapshot of formation layout tunables (usually spread from FORMATION). */
export interface FormationConfig {
    cols: number;
    rows: number;
    spacing: number;
    originX: number;
    originZ: number;
    hoverY: number | null;
    hoverPadding: number;
    rootVelocityX: number;
    rootVelocityZ: number;
}

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
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];

export interface StageCancelledPayload {
    reason: 'player_death' | 'manual' | 'dispose' | 'restart';
}

export interface IntroStartedPayload {
    reason: 'start' | 'restart';
}

export interface InvaderKilledPayload {
    id: number;
    typeId: string;
    scoreValue: number;
}
