import { VIEW } from '../data/constants';

export type FitRect = {
    width: number;
    height: number;
    left: number;
    top: number;
};

/** Design aspect width/height (e.g. 3/4). */
export function viewAspect(): number {
    return VIEW.aspectW / VIEW.aspectH;
}

/**
 * Largest rect of the given aspect that fits inside the window (contain).
 * Centers the result with left/top offsets (letterbox / pillarbox).
 */
export function fitContain(
    windowW: number,
    windowH: number,
    aspect: number = viewAspect(),
): FitRect {
    let width: number;
    let height: number;

    if (windowW / windowH > aspect) {
        // Window wider than design → height-limited (pillarbox)
        height = windowH;
        width = height * aspect;
    } else {
        // Window taller than design → width-limited (letterbox)
        width = windowW;
        height = width / aspect;
    }

    return {
        width,
        height,
        left: (windowW - width) * 0.5,
        top: (windowH - height) * 0.5,
    };
}

/** Apply a fit rect to a positioned element (e.g. #game-frame). */
export function applyFitRect(el: HTMLElement, fit: FitRect): void {
    el.style.left = `${fit.left}px`;
    el.style.top = `${fit.top}px`;
    el.style.width = `${fit.width}px`;
    el.style.height = `${fit.height}px`;
}

/**
 * Scale a design-resolution UI root so it matches the fitted frame.
 * UI is authored in VIEW.internalWidth × VIEW.internalHeight pixels.
 */
export function applyUiScale(uiRoot: HTMLElement, fit: FitRect): void {
    const sx = fit.width / VIEW.internalWidth;
    const sy = fit.height / VIEW.internalHeight;
    uiRoot.style.width = `${VIEW.internalWidth}px`;
    uiRoot.style.height = `${VIEW.internalHeight}px`;
    uiRoot.style.transformOrigin = '0 0';
    uiRoot.style.transform = `scale(${sx}, ${sy})`;
}

export function getGameFrame(): HTMLElement {
    const el = document.getElementById('game-frame');
    if (!el) {
        throw new Error('Missing #game-frame — check index.html');
    }
    return el;
}

export function getUiRoot(): HTMLElement {
    const el = document.getElementById('ui-root');
    if (!el) {
        throw new Error('Missing #ui-root — check index.html');
    }
    return el;
}
