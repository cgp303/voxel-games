/** Shared gameplay / layout constants (expand in later phases) */
export const GAME = {
    defaultLives: 3,
    invaderCols: 10,
    invaderRows: 6,
} as const;

export const CAMERA = {
    isoAngleDeg: 33,
    distanceFactor: 0.65,
} as const;

/** Demo attract mode: info panel ↔ high scores */
export const DEMO = {
    /** Seconds each attract panel stays visible before swapping */
    attractPanelSeconds: 6,
} as const;

export const GAME_OVER = {
    displaySeconds: 3,
} as const;
