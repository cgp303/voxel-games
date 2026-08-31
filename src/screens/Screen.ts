import type { GameContext } from '../app/GameContext';

/**
 * One active top-level mode (Demo or Play or Game Over).
 * High scores are an attract panel on Demo, not a separate screen.
 * Screens own mode-specific objects; shared core lives on GameContext.
 */
export interface Screen {
    readonly id: string;

    /** Build / show content for this mode */
    enter(ctx: GameContext): void | Promise<void>;

    /** Remove listeners and screen-owned meshes (not shared core) */
    exit(): void;

    /** Simulation + animation; dt in seconds */
    update(dt: number): void;

    /** Optional: react to viewport changes */
    resize?(width: number, height: number): void;
}
