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
