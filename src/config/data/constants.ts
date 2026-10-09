import * as THREE from 'three';
import type { InvaderTypeId } from '../types/types';
import type { IInvaderTypeDefinition } from '../interfaces/interfaces';
/** Shared gameplay / layout constants (expand in later phases) */
export const GAME = {
    defaultLives: 3,
    /** @deprecated Prefer FORMATION.cols — kept for legacy spawnInvaderGrid */
    invaderCols: 10,
    /** @deprecated Prefer FORMATION.rows */
    invaderRows: 6,
    /** @deprecated Prefer FORMATION.originX */
    invaderOriginX: 60,
    /** @deprecated Prefer FORMATION.originZ */
    invaderOriginZ: 100,
    /** @deprecated Prefer FORMATION.hoverPadding */
    invaderHoverPadding: 4,
    /** @deprecated Prefer FORMATION.hoverY */
    invaderHoverY: null as number | null, // if set, use absolute Y; else height + padding
} as const;

/** Slot lookups use the numeric key col * SLOT_KEY_STRIDE + row (avoids per-frame string keys). Must exceed any formation's row count. */
export const SLOT_KEY_STRIDE = 1024;

// Instanced asset configuration for the App.ts: a list of assets that should use instanced meshes.
// Every assetKey referenced by INVADER_TYPES must appear here (and in ASSET_PATHS).
export const INSTANCED_ASSETS: { key: string; maxCount: number }[] = [
    { key: 'invader1', maxCount: 80 },
    { key: 'invader2', maxCount: 80 },
    { key: 'invader3', maxCount: 80 },
    { key: 'invader', maxCount: 80 },
];

/** Per-type invader data: instanced mesh key, score value and hit points. */
export const INVADER_TYPES: Record<InvaderTypeId, IInvaderTypeDefinition> = {
    scout: { assetKey: 'invader1', scoreValue: 50, hitPoints: 1 },
    fighter: { assetKey: 'invader2', scoreValue: 100, hitPoints: 1 },
    elite: { assetKey: 'invader3', scoreValue: 200, hitPoints: 2 },
    tie: { assetKey: 'invader', scoreValue: 800, hitPoints: 4 },
};

/** Level progression. After the last level the session wraps to levels[loopFromIndex]. */
export const LEVEL = {
    loopFromIndex: 0,
} as const;

/** Dev/test helpers. Disable (or remove) before shipping. */
export const DEBUG = {
    /** Skip to the next wave by disposing all active invaders. */
    enableWaveSkip: true,
    /** KeyboardEvent.key that triggers the wave skip (Space = ' '). */
    skipWaveKey: ' ',
} as const;

export const INVADER_MESH_MATERIAL = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
    flatShading: false,  // ensure this is false
    roughness: 0.5,      // reduce from 0.7 (smoother)
    metalness: 0.0,      // reduce from 0.2
    normalScale: new THREE.Vector2(0.5, 0.5),  // add softer normals
});

/**
 * Square (or rectangular) invader grid — slot homes relative to a moving formation root.
 * Used by FormationController / PlaySession intro.
 *
 * Layout feel (10×6 @ spacing 8 ≈ 72×40 world units, centered on originX/Z).
 */
export const FORMATION = {
    cols: 10,
    rows: 6,
    /** World units between slot centers on X and Z (square grid when equal) */
    spacing: 12,
    /** Formation root world X (slot offsets are added to this) */
    originX: 0,
    /**
     * Formation root world Z — farther = higher on a typical top-down-ish view.
     * Entry Beziers end at live homes around this depth.
     */
    originZ: 78,
    /** If set, absolute hover Y; else terrain bounds.height + hoverPadding */
    hoverY: null as number | null,
    hoverPadding: 4,
    /**
     * Optional root drift (units/sec). Invaders re-read live homes each frame.
     * Keep 0 until sway is intentionally tuned; non-zero proves moving-formation docks.
     */
    rootVelocityX: 0,
    rootVelocityZ: 0,
} as const;

/**
 * Off-stage pair entry into formation (Demo + Play intro via PlaySession).
 *
 * Cadence: invadersPerSecond 2 ⇒ one L/R pair every 1s (overlapping in-flight OK).
 * Path: cubic Bezier, bottom-heavy bulge, mirrored L/R; center column alternates sides.
 * Orient: look along path tangent (−Z), bank about local +Z from yaw rate, dock-slerp to rest.
 *
 * Tune pathDuration / bulgeDepth / bank* first when the intro feels off.
 */
export const ENTRY = {
    /** Total invaders released per second (pair = 2 invaders) */
    invadersPerSecond: 10,
    /** Extra |X| beyond play half-width (or synthetic half-extent) for off-screen spawn */
    spawnMarginX: 22,
    /**
     * Half-extent used when PlayField.bounds.width is 0 / not yet set.
     * Spawn X = centerX ± (halfExtentX + spawnMarginX).
     */
    halfExtentX: 70,
    /**
     * Z push for bottom-heavy Bezier bulge (toward player when bulgeSignZ = -1).
     * Larger = deeper dive before climbing into formation.
     */
    bulgeDepth: 54,
    /** +1 or -1 along world Z for “toward player / bottom of screen” */
    bulgeSignZ: -7,
    /** Min |x - centerX| at the near-center control point (almost crosses midfield) */
    centerApproachX: 2,
    /** Seconds to traverse enter path (time-based t ∈ [0,1]) */
    pathDuration: 2.35,
    /** Optional Z bias added to spawn Z relative to home.z */
    spawnZBias: 0,
    /**
     * Bank (roll about local Z after path look) while turning.
     * Mesh flight face uses Three.js lookAt (−Z along tangent), then model baseQuat.
     */
    bankGain: -0.44,
    maxBankRad: 2.9,
    /** Higher = snappier path-facing / roll follow */
    orientSmooth: 8,
    /** Higher = faster slerp back to formation rest after dock */
    dockSmooth: 7,
    /**
     * When true, first invader each session gets a small forward ArrowHelper (debug axis).
     * Leave false in normal play.
     */
    debugForwardArrow: false,
} as const;

/**
 * Fixed portrait viewport: always 3:4.
 * Internal buffer is the render + UI design resolution; CSS contain-fits the frame.
 */
export const VIEW = {
    aspectW: 4,
    aspectH: 4,
    /** Fixed WebGL / post-process buffer (must match aspectW:aspectH) */
    internalWidth: 1280,
    internalHeight: 1280,
    /** Flat letterbox / pillarbox color behind #game-frame */
    bezelColor: '#0a0a0a',
} as const;

export const CAMERA = {
    isoAngleDeg: 36,
    distanceFactor: 0.3,
} as const;


/** Demo attract mode: info panel ↔ high scores */
export const DEMO = {
    /** Seconds each attract panel stays visible before swapping */
    attractPanelSeconds: 6,
} as const;

export const GAME_OVER = {
    displaySeconds: 3,
} as const;

/** Infinite-looking ground: two meshes loop on Z */
export const TERRAIN = {
    /** World units per second along Z (positive = +Z) */
    scrollSpeedZ: -24,
    /** When false, PlayField.updateScroll is a no-op */
    scrollEnabledDefault: true,
} as const;



