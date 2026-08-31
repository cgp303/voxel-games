/** High-level game mode / screen identity (high scores live inside demo attract) */
export type GameMode = 'demo' | 'play' | 'game_over';

export interface ScoreEntry {
    name: string;
    score: number;
    date?: string;
}
