/** High-level game mode / screen identity (high scores live inside demo attract) */
export type GameMode = 'demo' | 'play';

export interface ScoreEntry {
    name: string;
    score: number;
    date?: string;
}
