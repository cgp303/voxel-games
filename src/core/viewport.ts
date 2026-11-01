import { VIEW } from '../config/data/constants';
import type { FitRect } from '../config/types/types';
import type { IMobileControlsConfig, IMobileLayout } from '../config/interfaces/interfaces';


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
 * Places the game and the mobile joystick so they do not overlap when possible.
 * The panel goes beside the game when the window is wider than the game's aspect (landscape for a square game) and
 * below it otherwise. If the spare space is too small the game shrinks (by at most config.maxGameShrink) to make
 * room; failing that the game keeps its full contain-fit and the joystick overlays one of its bottom corners.
 */
export function computeMobileLayout(
    windowW: number,
    windowH: number,
    config: IMobileControlsConfig,
    aspect: number = viewAspect(),
): IMobileLayout {
    const diameter = Math.min(
        config.maxDiameterPx,
        Math.max(config.minDiameterPx, Math.min(windowW, windowH) * config.sizeFraction),
    );
    const panel = diameter + 2 * config.marginPx;
    const full = fitContain(windowW, windowH, aspect);
    const minGameWidth = full.width * (1 - config.maxGameShrink);
    const square = (left: number, top: number): FitRect => ({ left, top, width: diameter, height: diameter });

    if (windowW / windowH > aspect) {
        let game: FitRect | null = full;
        if (full.left < panel) {
            const shrunk = fitContain(windowW - panel, windowH, aspect);
            if (config.landscapeSide === 'left') shrunk.left += panel;
            game = shrunk.width >= minGameWidth ? shrunk : null;
        }
        if (game) {
            const stripLeft = config.landscapeSide === 'right' ? game.left + game.width : 0;
            const stripRight = config.landscapeSide === 'right' ? windowW : game.left;
            const left = (stripLeft + stripRight - diameter) / 2;
            return { game, joystick: square(left, windowH - config.marginPx - diameter), mode: 'side' };
        }
    } else {
        let game: FitRect | null = full;
        if (full.top < panel) {
            const shrunk = fitContain(windowW, windowH - panel, aspect);
            game = shrunk.width >= minGameWidth ? shrunk : null;
        }
        if (game) {
            const stripTop = game.top + game.height;
            const top = (stripTop + windowH - diameter) / 2;
            const left =
                config.portraitAlign === 'left'
                    ? config.marginPx
                    : config.portraitAlign === 'right'
                      ? windowW - config.marginPx - diameter
                      : (windowW - diameter) / 2;
            return { game, joystick: square(left, top), mode: 'bottom' };
        }
    }

    const top = full.top + full.height - config.marginPx - diameter;
    const left =
        config.overlayCorner === 'right'
            ? full.left + full.width - config.marginPx - diameter
            : full.left + config.marginPx;
    return { game: full, joystick: square(left, top), mode: 'overlay' };
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
