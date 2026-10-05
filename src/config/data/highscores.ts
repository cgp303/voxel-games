import type { IScoreEntry } from '../interfaces/interfaces';

const STORAGE_KEY = 'voxel-galaga-highscores';
const MAX_ENTRIES = 10;

/** Phase 0: localStorage helpers; UI wires in Phase 2 */
export function loadHighScores(): IScoreEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as IScoreEntry[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveHighScores(entries: IScoreEntry[]): void {
    const trimmed = [...entries]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function trySubmitScore(name: string, score: number): IScoreEntry[] {
    const entries = loadHighScores();
    entries.push({ name, score, date: new Date().toISOString() });
    saveHighScores(entries);
    return loadHighScores();
}
