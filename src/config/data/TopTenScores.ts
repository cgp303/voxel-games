import type { IHighScoreRow } from '../interfaces/interfaces';

/**
 * The top-ten table. For now it is dummy data; later it will be fetched from the high-score server as JSON
 * in this same shape, so callers should only use getScores().
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
}
