/** Number of dots in a full bar; matches the width of #preload-dots in index.html. */
const BAR_DOTS = 32;
/** Longest the fade-out may take before the curtain is removed anyway (in case transitionend never fires). */
const FADE_TIMEOUT_MS = 1000;

/**
 * Drives the preload curtain in index.html: counts tracked loads and fills the bar as they finish.
 * Register every load in the same tick (before any of them is awaited) so the bar never moves backwards.
 */
export class Preloader {
    private total = 0;
    private finished = 0;
    private readonly curtain = document.getElementById('preload-curtain');
    private readonly dots = document.getElementById('preload-dots');

    /** Counts a load toward the bar. A failed load still counts as finished, so the bar always completes. */
    public readonly track = <T>(load: Promise<T>): Promise<T> => {
        this.total++;
        return load.finally(() => {
            this.finished++;
            this.render();
        });
    };

    /** Fades the curtain out and removes it. */
    public finish(): Promise<void> {
        const curtain = this.curtain;
        if (!curtain) return Promise.resolve();
        this.finished = this.total;
        this.render();
        return new Promise((resolve) => {
            const remove = (): void => {
                curtain.remove();
                resolve();
            };
            curtain.addEventListener('transitionend', remove, { once: true });
            setTimeout(remove, FADE_TIMEOUT_MS);
            curtain.classList.add('done');
        });
    }

    private render(): void {
        if (!this.dots) return;
        const progress = this.total > 0 ? this.finished / this.total : 1;
        this.dots.textContent = '.'.repeat(Math.round(progress * BAR_DOTS));
    }
}

/** Counts a load toward the preload bar and returns it unchanged. */
export type TrackLoad = <T>(load: Promise<T>) => Promise<T>;
