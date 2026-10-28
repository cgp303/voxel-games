import type { IHighScoreRow } from '../interfaces/interfaces';
import { HIGH_SCORE_SERVER } from './constants';

/**
 * The top-ten table. It starts as dummy data and is replaced by the live table from the high-score server
 * (HIGH_SCORE_SERVER) whenever fetchFromServer() succeeds; callers should read it through getScores().
 */
export class TopTenScores {
    static scores: IHighScoreRow[] = [
        { rank: 1, score: 50000, name: 'ACE' },
        { rank: 2, score: 45000, name: 'TOP' },
        { rank: 3, score: 40000, name: 'PRO' },
        { rank: 4, score: 35000, name: 'VET' },
        { rank: 5, score: 30000, name: 'EXP' },
        { rank: 6, score: 25000, name: 'ADV' },
        { rank: 7, score: 20000, name: 'MID' },
        { rank: 8, score: 15000, name: 'LOW' },
        { rank: 9, score: 10000, name: 'NEW' },
        { rank: 10, score: 5000, name: 'BEG' },
    ];

    static getScores(): readonly IHighScoreRow[] {
        return this.scores;
    }

    /** Downloads the live table. On any failure the cached table is kept (and logged). Never rejects. */
    static async fetchFromServer(): Promise<readonly IHighScoreRow[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HIGH_SCORE_SERVER.timeoutMs);
        try {
            const response = await fetch(`${HIGH_SCORE_SERVER.url}/scores`, { signal: controller.signal });
            if (!response.ok) throw new Error(`server returned status ${response.status}`);
            const rows = parseRows(await response.json());
            if (!rows) throw new Error('unexpected response shape');
            this.scores = ranked(rows);
        } catch (error) {
            console.warn('[TopTenScores] could not fetch live scores, using cached scores:', error);
        } finally {
            clearTimeout(timeoutId);
        }
        return this.scores;
    }

    /** True when `score` would earn a place in the table (a tie with the last place does not). */
    static qualifies(score: number): boolean {
        if (score <= 0) return false;
        if (this.scores.length < HIGH_SCORE_SERVER.tableSize) return true;
        return score > this.scores[this.scores.length - 1].score;
    }

    /** Adds a score to the local table. Returns the rank achieved (1-based), or null if it did not make the table. */
    static insertScore(score: number, name: string): number | null {
        const index = this.scores.findIndex((row) => score > row.score);
        const insertAt = index === -1 ? this.scores.length : index;
        if (insertAt >= HIGH_SCORE_SERVER.tableSize) return null;
        this.scores = ranked([...this.scores.slice(0, insertAt), { rank: 0, score, name }, ...this.scores.slice(insertAt)]);
        return insertAt + 1;
    }

    /**
     * Uploads `{ score, name }` to the high-score server, then refreshes the table so it matches the server.
     * On any failure the local table is kept (and logged). Never rejects.
     */
    static async submitScore(score: number, name: string): Promise<void> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HIGH_SCORE_SERVER.timeoutMs);
        try {
            const response = await fetch(`${HIGH_SCORE_SERVER.url}/scores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score, name }),
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`server returned status ${response.status}`);
        } catch (error) {
            console.warn('[TopTenScores] could not upload score, kept locally only:', error);
            return;
        } finally {
            clearTimeout(timeoutId);
        }
        await this.fetchFromServer();
    }
}

/** Sorts high to low, keeps the table size and renumbers the ranks. */
function ranked(rows: readonly IHighScoreRow[]): IHighScoreRow[] {
    return [...rows]
        .sort((a, b) => b.score - a.score)
        .slice(0, HIGH_SCORE_SERVER.tableSize)
        .map((row, i) => ({ ...row, rank: i + 1 }));
}

function parseRows(data: unknown): IHighScoreRow[] | null {
    if (!Array.isArray(data)) return null;
    const rows: IHighScoreRow[] = [];
    for (const item of data) {
        const { score, name } = (item ?? {}) as { score?: unknown; name?: unknown };
        if (typeof score !== 'number' || typeof name !== 'string') return null;
        rows.push({ rank: 0, score, name });
    }
    return rows;
}
