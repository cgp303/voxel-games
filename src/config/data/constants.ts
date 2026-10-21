import * as THREE from 'three';
import { Vector3 } from 'three';
import type { InvaderTypeId, InvaderWeaponType, WeaponType, BossWeaponType } from '../types/types';
import type { IFxSettings, IInvaderTypeDefinition, IInvaderWeaponConfig, IWeaponConfig, ICollisionSystemConfig, IDebrisConfig, ISparkConfig, ITextDisplay, INextLevelFlyby, IVoxelAssemblyConfig, IBossSettings, IBossPathDef, IBossWeaponConfig } from '../interfaces/interfaces';
import { CollisionLayer } from '../types/types';
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
    { key: 'player', maxCount: 1 },
    { key: 'lazer', maxCount: 32 },
    { key: 'mine', maxCount: 32 },
    { key: 'minehit1', maxCount: 32 },
    { key: 'minehit2', maxCount: 32 },
    { key: 'invlazer1', maxCount: 32 },
    { key: 'invlazer2', maxCount: 32 },
];

/** Per-type invader data: instanced mesh key, score value and hit points. */
export const INVADER_TYPES: Record<InvaderTypeId, IInvaderTypeDefinition> = {
    scout: { assetKey: 'invader1', scoreValue: 50, hitPoints: 1 },
    fighter: { assetKey: 'invader2', scoreValue: 100, hitPoints: 1 },
    elite: { assetKey: 'invader3', scoreValue: 200, hitPoints: 2 },
    tie: { assetKey: 'invader', scoreValue: 800, hitPoints: 4 },
};

/** Instanced mesh keys used by invaders only (INSTANCED_ASSETS also holds the player mesh). */
export const INVADER_ASSET_KEYS: readonly string[] = [
    ...new Set(Object.values(INVADER_TYPES).map((def) => def.assetKey)),
];

/**
 * Player ship. World axes: X is lateral, Z is depth (+Z is away from the camera / up the screen).
 * The camera looks along +Z from negative Z, so screen-right is world -X (screenRightSign = -1).
 * Tune limits and spawn visually against the terrain/camera framing.
 */
export const PLAYER = {
    assetKey: 'player',
    /** Max lateral / depth speed (world units per second). */
    maxSpeedX: 90,
    maxSpeedZ: 40,
    /** Higher = snappier velocity response to input (exponential smoothing rate). */
    accel: 10,
    /** Max roll (radians) at full lateral speed. */
    maxBankRad: 0.6,
    /** Higher = faster bank response. */
    bankSmooth: 8,
    /** World X of screen-right: -1 with the current camera. Flip if left/right feel reversed. */
    screenRightSign: -1,
    /** Movement limits (world units). Z range is a small band around spawnZ. */
    minX: -70,
    maxX: 70,
    spawnZ: -110,
    zRange: 25,
    /** Height above the terrain. */
    hoverPadding: 11,
    /** KeyboardEvent.key values. */
    keys: {
        left: ['ArrowLeft', 'a', 'A'],
        right: ['ArrowRight', 'd', 'D'],
        forward: ['ArrowUp', 'w', 'W'],
        back: ['ArrowDown', 's', 'S'],
        fire: [' '],
    },
    /** Weapon the ship fires (held fire key repeats at the weapon's fire rate). */
    weapon: 'Laser' as WeaponType,
    /** After losing a life the ship reappears at its spawn point: it flashes, cannot fire and ignores collisions. */
    respawn: {
        durationSec: 3,
        /** Time the ship spends visible, then hidden, per flash half-cycle. */
        flashIntervalSec: 0.12,
    },
} as const;

/** Weapon tuning per type. Shots fly along +Z and fade out once past despawnZ. */
export const WEAPONS: Record<WeaponType, IWeaponConfig> = {
    Laser: {
        assetKey: 'lazer',
        maxCount: 32,
        fireIntervalSec: 0.25,
        speed: 180,
        despawnZ: 320,
        fadeDurationSec: 0.15,
        muzzleOffset: { x: 0, y: 0, z: 4 },
        modelRotationY: 0,
        castShadow: false,
        collisionLayer: CollisionLayer.PLAYER_MISSILE,
        collisionRadius: 2,
        destroysMines: true,
        power: 1,
    },
};

/**
 * Weapons used by invaders. Each type has its own pooled, instanced mesh.
 * Drops are limited by invader type and by the path segment being flown.
 */
export const INVADER_WEAPONS: Record<InvaderWeaponType, IInvaderWeaponConfig> = {
    Mine: {
        kind: 'mine',
        assetKey: 'mine',
        maxCount: 32,
        dropChancePerFrame: { groupAttack1: [0.1, 0.07, 0.05] },
        releaseXRange: { min: -70, max: 70 },
        maxPerAttack: 5,
        allowedInvaderTypes: ['scout', 'fighter', 'elite', 'tie'],
        allowedSegments: { groupAttack1: [1, 2, 3] },
        despawnMarginPastPlayer: 50,
        spinRateRadPerSec: Math.PI * 4,
        hitPoints: 3,
        knockbackDistance: 24,
        knockbackSpeed: 90,
        collisionRadius: 2,
        castShadow: true,
        velocity: new THREE.Vector3(0, 0, -36),
        hitMeshes: ['minehit1', 'minehit2'],
    },
    /** Two lazers per column-vertical attack, each flying the way the invader was heading. */
    LazerA: {
        kind: 'lazer',
        assetKey: 'invlazer1',
        maxCount: 32,
        allowedInvaderTypes: ['scout', 'fighter', 'elite', 'tie'],
        allowedSegments: { columnVertical: [2], columnDives: [1] },
        despawnMarginPastPlayer: 50,
        collisionRadius: 2,
        castShadow: false,
        speed: { columnVertical: [220], columnDives: [220] },
        aim: { mode: 'inheritHeading', shots: 1, intervalSec: 0.25 },
        segmentProgress: { columnVertical: [0.4], columnDives: [0.4] },
        dropChancePerFrame: { columnVertical: [0.2], columnDives: [0.2] },
        glow: true,
    },
    /** One lazer per attack: the invader yaws to face the player, fires at them, then yaws back to its path. */
    LazerB: {
        kind: 'lazer',
        assetKey: 'invlazer2',
        maxCount: 32,
        allowedInvaderTypes: ['scout', 'fighter', 'elite', 'tie'],
        allowedSegments: { lazerBAttack: [0, 2] },
        despawnMarginPastPlayer: 50,
        collisionRadius: 2,
        castShadow: false,
        speed: { lazerBAttack: [120, 120] },
        aim: { mode: 'atPlayer', turnInSec: 0.1, faceTimeoutSec: 0.2, holdSec: 0.2, turnOutSec: 0.2, facingToleranceRad: 0.05, aimNoiseRad: 0.5, noPlayerTarget: { x: 0, y: 20, z: -160 } },
        segmentProgress: { lazerBAttack: [0.7, 0.1] },
        dropChancePerFrame: { lazerBAttack: [0.025, 0.025] },
        glow: true,
    },
};

export const INVADER_WEAPON_TYPES = Object.keys(INVADER_WEAPONS) as InvaderWeaponType[];

/**
 * Collision detection (see systems/collision). Shots are swept along their path and tested against
 * invader footprints baked from the voxel models, collapsed onto the X/Z plane; Y is only a filter.
 */
export const COLLISION = {
    /** Roll angles (about the travel axis) baked per model. More = tighter silhouette, more memory. */
    rollBuckets: 64,
    /** Footprint cells per world unit. Must be at least 1; 2 keeps voxel edges on cell edges. */
    maskResolution: 2,
    /** Broadphase grid. Cell size should be about 1-2x the largest invader; targets outside the bounds still work. */
    grid: { minX: -160, maxX: 160, minZ: -160, maxZ: 260, cellSize: 16 },
    /** Layers tested without the broadphase (single entities). */
    directLayers: CollisionLayer.PLAYER,
    /** Radius of the circle that stands in for an invader when it rams the player. */
    invaderRadius: 3,
    /** Which mover layers hit which target layers. yTolerance = max Y gap between origins (Infinity = ignore Y). */
    rules: [
        {
            mover: CollisionLayer.PLAYER_MISSILE,
            targets: CollisionLayer.INVADER | CollisionLayer.INVADER_WEAPON_SHOOTABLE,
            yTolerance: Infinity,
        },
        {
            mover: CollisionLayer.INVADER,
            targets: CollisionLayer.PLAYER,
            yTolerance: Infinity,
        },
        {
            mover: CollisionLayer.INVADER_WEAPON,
            targets: CollisionLayer.PLAYER,
            yTolerance: Infinity,
        },
        {
            mover: CollisionLayer.INVADER_WEAPON_SHOOTABLE,
            targets: CollisionLayer.PLAYER,
            yTolerance: Infinity,
        },
    ],
} satisfies ICollisionSystemConfig & { rollBuckets: number; maskResolution: number; invaderRadius: number };

/** Visual effects. Glow uses a selective bloom pass over meshes on `layer`. */
export const FX: IFxSettings = {
    enabled: true,
    layer: 1,
    shotEmissiveIntensity: 0.5,
    bloom: {
        strength: 1,
        radius: 0.25,
        resolutionScale: 0.5,
    },
};

/**
 * Directional-light shadow map. The ortho frustum should cover only the playable ground, and the map size
 * is chosen for about 3 texels per world unit on both axes (see Scene.createLights).
 */
export const SHADOW = {
    mapWidth: 1024,
    mapHeight: 2048,
    /** Half-extent of the frustum on the light's vertical axis (about 0.9 x world Z). */
    halfExtentZ: 300,
    /** World Z the shadow frustum is centred on (the play area runs from the camera at about -170 to z 320). */
    centerZ: 80,
    near: 400,
    far: 1300,
    bias: -0.001,
} as const;

/**
 * Explosion debris: a destroyed model breaks into one cube per voxel that flies out, tumbles, falls
 * under gravity and bounces off the (scrolling) terrain. See systems/fx.
 */
export const EXPLOSION: IDebrisConfig = {
    maxParticles: 4000,
    gravity: 80,
    airDrag: 0.25,
    restitution: 0.45,
    bounceFriction: 0.2,
    contactFriction: 3,
    spinImpactDamping: 0.65,
    spinContactDamping: 2.5,
    restSpeed: 4,
    particleSize: 1,
    fadeSec: 0.1,
    killBelowY: -60,
    maxStepSec: 1 / 20,
    profiles: {
        invader: {
            speed: [14, 38],
            upward: [32, 92],
            scatter: 1,
            inheritVelocity: 0.5,
            spin: [4, 16],
            life: [0.5, 1],
            glow: { color: [1, 0.85, 0.55], intensity: 3, durationSec: 1.3 },
        },
        player: {
            speed: [20, 52],
            upward: [10, 30],
            scatter: 8,
            inheritVelocity: 0.5,
            spin: [4, 18],
            life: [1, 2.5],
            glow: { color: [0.6, 0.85, 1], intensity: 3, durationSec: 1.3 },
        },
        text: {
            speed: [20, 52],
            upward: [10, 80],
            scatter: 5,
            inheritVelocity: 0,
            spin: [4, 16],
            life: [0.8, 2.6],
            glow: { color: [0.5, 1, 0.4], intensity: 2.5, durationSec: 1.5 },
        },
        /** A destroyed boss part: a short, hot burst. */
        bossPart: {
            speed: [12, 40],
            upward: [10, 50],
            scatter: 4,
            inheritVelocity: 0.4,
            spin: [4, 14],
            life: [0.8, 2.6],
            glow: { color: [1, 0.7, 0.3], intensity: 3, durationSec: 1.5 },
        },
        /** A chunk of boss cut off from the rest: it drops away rather than bursting, trailing its glow. */
        bossChunk: {
            speed: [2, 10],
            upward: [0, 8],
            scatter: 2,
            inheritVelocity: 0.8,
            spin: [1, 6],
            life: [1.6, 3],
            glow: { color: [1, 0.45, 0.1], intensity: 3, durationSec: 2.2 },
        },
        /** The final explosion of a boss. */
        boss: {
            speed: [20, 70],
            upward: [20, 90],
            scatter: 10,
            inheritVelocity: 0.3,
            spin: [4, 18],
            life: [1.2, 3],
            glow: { color: [1, 0.8, 0.45], intensity: 3.5, durationSec: 1.8 },
        },
    },
};

/** Sparks thrown off an invader weapon when a shot hits but does not destroy it. See systems/fx/SparkSystem. */
export const SPARKS: ISparkConfig = {
    maxParticles: 256,
    size: 1.3,
    count: [4, 9],
    speed: [30, 70],
    direction: { x: 0, y: 1, z: 1 },
    spread: 0.9,
    gravity: 5,
    life: [0.4, 1],
    inheritVelocity: 0.5,
    hotColor: [1, 0.9, 0.55],
    hotIntensity: 2,
    redColor: [1, 0.08, 0.02],
    redAtFraction: 0.55,
};

/** Boss behaviour shared by every boss (each boss's own layout is its JSON file; see systems/boss). */
export const BOSS: IBossSettings = {
    assetFolder: 'assets/vox/bosses',
    ids: ['boss1'],
    hoverPadding: 8,
    entranceZ: 270,
    entranceSeconds: 1,
    rollSmooth: 4,
    contactRadius: 5,
    dripIntervalSec: [0.5, 0.06],
};

/** The fire a damaged boss drips: embers that fall slowly from the edges of the holes shot in it. */
export const BOSS_DRIP: ISparkConfig = {
    maxParticles: 192,
    size: 1,
    count: [10, 20],
    speed: [10, 20],
    direction: { x: 0, y: 3, z: 0 },
    spread: 1.2,
    gravity: 5,
    life: [0.8, 1.5],
    inheritVelocity: 0.6,
    hotColor: [1, 0.65, 0.2],
    hotIntensity: 3,
    redColor: [1, 0.1, 0.02],
    redAtFraction: 0.5,
};

/**
 * Paths a boss can fly (named by a boss's JSON). X/Z positions of cubic Bezier pieces, looped; the boss holds a
 * fixed height above the terrain. Like the formation's path, but the boss turns this into a roll, never a yaw.
 */
export const BOSS_PATHS: Record<string, IBossPathDef> = {
    bossSweep1: {
        segments: [
            { p0: new Vector3(0, 20, 70), p1: new Vector3(58, 20, 20), p2: new Vector3(58, 20, -20), p3: new Vector3(50, 20, -70) },
            { p0: new Vector3(50, 20, -70), p1: new Vector3(10, 20, 20), p2: new Vector3(-10, 20, 20), p3: new Vector3(-50, 20, -50) },
            { p0: new Vector3(-50, 20, -50), p1: new Vector3(-10, 20, 20), p2: new Vector3(10, 20, 20), p3: new Vector3(50, 20, -50) },
            { p0: new Vector3(50, 20, -50), p1: new Vector3(10, 20, 20), p2: new Vector3(-10, 20, 20), p3: new Vector3(-50, 20, -50) },
            { p0: new Vector3(-50, 20, -50), p1: new Vector3(30, 20, -10), p2: new Vector3(-30, 20, 10), p3: new Vector3(0, 20, 70) },
        ],
    },
};

/** Weapons a boss can carry. Which models, how often and from where are the boss's own JSON; this is how each behaves. */
export const BOSS_WEAPONS: Record<BossWeaponType, IBossWeaponConfig> = {
    BossLazerA: {
        kind: 'lazer',
        maxCount: 50,
        collisionRadius: 2,
        castShadow: false,
        glow: true,
        despawnMarginPastPlayer: 50,
        defaultSpeed: 200,
    },
    BossLazerB: {
        kind: 'lazer',
        maxCount: 50,
        collisionRadius: 2,
        castShadow: false,
        glow: true,
        despawnMarginPastPlayer: 50,
        defaultSpeed: 200,
    },
    BossBombA: {
        kind: 'lazer',
        maxCount: 30,
        collisionRadius: 2,
        castShadow: true,
        glow: false,
        despawnMarginPastPlayer: 50,
        defaultSpeed: 100,
    },
    Missile: {
        kind: 'missile',
        maxCount: 15,
        collisionRadius: 3,
        castShadow: true,
        glow: false,
        despawnMarginPastPlayer: 50,
        defaultSpeed: 90,
        guidance: 'bezierThenHoming',
        bezierBow: 0.3,
        turnRateRadPerSec: 1.4,
        maxLifeSec: 9,
        hitPoints: 2,
        spinRateRadPerSec: Math.PI * 2,
    },
};

/** Level progression. After the last level the session wraps to levels[loopFromIndex]. */
export const LEVEL = {
    loopFromIndex: 0,
    /** Pause (s) showing "NEXT WAVE" after the last invader of a wave is destroyed. */
    waveClearDelaySec: 2.5,
} as const;

/** Dev/test helpers. Disable (or remove) before shipping. */
export const DEBUG = {
    /** When true the player ignores collisions (no life lost, no removal) so the game can be tested freely. */
    invinciblePlayer: true,
    /** Skip to the next wave by disposing all active invaders. */
    enableWaveSkip: true,
    /** KeyboardEvent.key values that trigger the wave skip (both cases so Shift/Caps Lock still work). */
    skipWaveKeys: ['l', 'L'],

} as const;

/** Voxel mesh generation options (see VoxelGeometry). */
export const VOXEL_MESH = {
    /**
     * true: write each face's normal directly while building the mesh (fastest).
     * false: build the mesh without normals, then run geometry.computeVertexNormals().
     */
    flatFaceNormals: true,
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
    isoAngleDeg: 16,
    distanceFactor: 0.35,
} as const;

// export const CAMERA = {
//     isoAngleDeg: 35,
//     distanceFactor: 0.325,
// } as const;


/** Demo attract mode: info panel ↔ high scores */
export const DEMO = {
    /** Seconds each attract panel stays visible before swapping */
    attractPanelSeconds: 6,
} as const;

/** The GAME OVER text: what it says and how it looks. */
export const GAME_OVER_TEXT: ITextDisplay = {
    text: 'GAME OVER',
    /** Neon green. */
    color: 0x00ff00,
    /** World units per voxel (also the debris cube size). */
    scale: 1,
    /** How far in front of the camera the text floats (world units). The text is a real world object, so keep it above the terrain. */
    cameraDistance: 100,
    /** Shift along the camera's right and up axes (world units). */
    offsetX: 0,
    offsetY: 20,
    /** Dimmer than the full colour; the bloom is set separately by glowIntensity. */
    brightness: 0.6,
    /** Strength of the glow: 1 blooms the text as brightly as its full colour, lower is subtler, 0 is none. */
    glowIntensity: 0,
    /** Omit `pitch` to face the camera squarely. 0 stands the text upright; 90 lies it flat face-up. */
    pitch: 90,
};

/** Movement of the between-waves text; its wording and look are in NEXT_LEVEL_TEXT and BOSS_WAVE_TEXT. */
export const NEXT_LEVEL_FLYBY: INextLevelFlyby = {
    /** World Z where the text pauses (its X and Y are those of GAME_OVER_TEXT). */
    pauseZ: -80,
    /** Z the text starts from, this far behind the camera (world units), so it is out of sight until it zooms in. */
    startBehindCamera: 100,
    /** World Z at which the text is removed; far enough away to be lost in the fog. */
    endZ: 800,
    approachSeconds: 1,
    pauseSeconds: 1,
    departSeconds: 1,
};

/** The text shown between waves. Matches GAME_OVER_TEXT (colour, material, orientation, height) but glows. */
export const NEXT_LEVEL_TEXT: ITextDisplay = {
    ...GAME_OVER_TEXT,
    text: 'NEXT WAVE',
    glowIntensity: 1,
};

/** Shown instead of NEXT_LEVEL_TEXT when the wave that follows is a boss fight. */
export const BOSS_WAVE_TEXT: ITextDisplay = {
    ...NEXT_LEVEL_TEXT,
    text: 'BOSS',
    color: 0xff0000,
};

export const GAME_OVER = {
    /** Seconds before the player's explosion ends at which the Game Over screen takes over, so the two overlap. */
    overlapSeconds: 1,
    /** Seconds the whole text is shown, once built, before the letters start to explode. */
    displaySeconds: 3,
    /** Seconds between one letter exploding and the next. */
    explodeIntervalSec: 0.05,
    /** Debris pool size for the letters. */
    maxDebris: 1200,
    /**
     * The invaders left on the field stay until the Demo screen takes over. When true they also blow up, one at
     * a time, as the letters start to explode; when false they simply disappear at the hand-off.
     */
    explodeInvaders: true,
    /** Seconds between one remaining invader exploding and the next. */
    invaderExplodeIntervalSec: 0.04,
} as const;

/** The intro in which the text's voxels swoop in from all around and build the letters. */
export const GAME_OVER_ASSEMBLY: IVoxelAssemblyConfig = {
    assembleSeconds: 4,
    travelSeconds: 2.1,
    spawnRadius: [150, 300],
    minElevationDeg: 5,
    curve: 0.35,
    spinTurns: 1.5,
    flashSeconds: 0.25,
    flashIntensity: 1.5,
};

/**
 * Voxel text (see systems/text). Text sits on its own object layer, which the bloom pass also draws so it glows.
 * Glyphs are 10 voxels tall; each is trimmed to its used columns and spaced by `letterGap`.
 * These are font-wide; per-display settings (colour, scale, glow...) live in an ITextDisplay such as GAME_OVER_TEXT.
 */
export const TEXT = {
    layer: 2,
    cellHeight: 10,
    /** Width of a space, in voxels. */
    spaceWidth: 6,
    /** Default empty voxels between the last used column of one glyph and the first of the next. */
    letterGap: 1,
} as const;

/** Infinite-looking ground: two meshes loop on Z */
export const TERRAIN = {
    /** World units per second along Z (positive = +Z) */
    scrollSpeedZ: -48,
    /** When false, PlayField.updateScroll is a no-op */
    scrollEnabledDefault: true,
} as const;



