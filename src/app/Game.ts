import type { GameMode, ScoreEntry } from './types';

/**
 * High-level game facade: score, lives, mode.
 * Screens read/write this; persistence lands in Phase 2+.
 */
export class Game {
    public mode: GameMode = 'demo';
    public score = 0;
    public lives = 3;
    public highScores: ScoreEntry[] = [];

    public resetRun(): void {
        this.score = 0;
        this.lives = 3;
    }

    public addScore(points: number): void {
        this.score += points;
    }

    public loseLife(): boolean {
        this.lives = Math.max(0, this.lives - 1);
        return this.lives <= 0;
    }
}
