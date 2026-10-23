/** The score as the HUD shows it: whole, never negative, capped at all nines, zero-padded to `digits` (so growth shows from the right). */
export function formatScore(score: number, digits: number): string {
    const capped = Math.min(Math.max(0, Math.floor(score)), 10 ** digits - 1);
    return String(capped).padStart(digits, '0');
}
