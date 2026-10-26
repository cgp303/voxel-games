/**
 * `preload: true` assets load behind the preload curtain and the game waits for them; `preload: false` assets load
 * in the background once the curtain is gone (anything that asks for one first simply waits for it).
 */
export interface IManifestEntry {
    src: string;
    preload: boolean;
}

/** Asset path keys used by AssetManager (Phase 2+) */
// Assets are served from public/assets/vox/
export const ASSET_PATHS = {
    invader: { src: 'assets/vox/inv10.vox', preload: true },
    invader1: { src: 'assets/vox/inv7.vox', preload: true },
    invader2: { src: 'assets/vox/inv9.vox', preload: true },
    invader3: { src: 'assets/vox/inv8.vox', preload: true },
    player: { src: 'assets/vox/player.vox', preload: true },
    lazer: { src: 'assets/vox/lazer1.vox', preload: true },
    mine: { src: 'assets/vox/bomb1.vox', preload: true },
    minehit1: { src: 'assets/vox/bomb1hit1.vox', preload: true },
    minehit2: { src: 'assets/vox/bomb1hit2.vox', preload: true },
    invlazer1: { src: 'assets/vox/inv-lazer1.vox', preload: true },
    invlazer2: { src: 'assets/vox/inv-lazer2.vox', preload: true },
} as const satisfies Record<string, IManifestEntry>;

export type AssetKey = keyof typeof ASSET_PATHS;

/** Font glyphs by character (letters are lower case; look them up with `fontGlyphPath`). All glyphs are white. */
export const FONT_PATHS: Readonly<Record<string, string>> = Object.fromEntries([
    ...'0123456789abcdefghijklmnopqrstuvwxyz'.split('').map((c) => [c, `assets/vox/font/${c}.vox`]),
    [':', 'assets/vox/font/colon.vox'],
    ['.', 'assets/vox/font/period.vox'],
]);

/** .vox path for a character, or undefined when the font has no glyph for it (for example a space). */
export function fontGlyphPath(char: string): string | undefined {
    return FONT_PATHS[char.toLowerCase()];
}


/////////// Audio assets
export interface IAudioManifestEntry extends IManifestEntry {
    volume: number;
    loop: boolean;
}

export const AUDIO_PATHS = {
    // mp3
    playerFiresLazer: { src: 'assets/audio/player-lazer.mp3', volume: 0.25, loop: false, preload: true },
    playerDied: { src: 'assets/audio/player-explosion.mp3', volume: 1, loop: false, preload: true },
    gameStart: { src: 'assets/audio/game-start-jingle.mp3', volume: 1, loop: false, preload: true },
    gameOver: { src: 'assets/audio/gameover-a.mp3', volume: 1, loop: false, preload: true },
    gameOverAssembly: { src: 'assets/audio/gameover-assembly.mp3', volume: 0.6, loop: false, preload: true },
    gameOverExplosion: { src: 'assets/audio/gameover-explosion.mp3', volume: 1, loop: false, preload: true },
    invaderLazerA: { src: 'assets/audio/invader-lazer1d.mp3', volume: 1, loop: false, preload: true },
    invaderKilled: { src: 'assets/audio/invader-explosion.mp3', volume: 0.1, loop: false, preload: true },
    mineDestroyed: { src: 'assets/audio/mine-explosion.mp3', volume: 1, loop: false, preload: true },
    mineHit: { src: 'assets/audio/mine-clonk.mp3', volume: 1, loop: false, preload: true },
    mineHit2: { src: 'assets/audio/mine-clonk-2.mp3', volume: 1, loop: false, preload: true },
    nextWave: { src: 'assets/audio/next-wave.mp3', volume: 1, loop: false, preload: true },
    bossWave: { src: 'assets/audio/boss-wave.mp3', volume: 1, loop: false, preload: true },
    boss1Bomb: { src: 'assets/audio/boss1-bomb.mp3', volume: 1, loop: false, preload: true },
    boss1PartDestroyed: { src: 'assets/audio/boss1-part-explosion.mp3', volume: 1, loop: false, preload: true },
    boss1PartFallsOff: { src: 'assets/audio/boss1-part-drops-off.mp3', volume: 1, loop: false, preload: true },
    boss1Explosion: { src: 'assets/audio/boss1-explosion.mp3', volume: 1, loop: false, preload: true },

    // wav (wav files loop better)
    mineActivated: { src: 'assets/audio/mine-loop1.wav', volume: 1, loop: true, preload: true },
    boss1LazerOn: { src: 'assets/audio/boss1-lazers.wav', volume: 1, loop: true, preload: true },

} as const satisfies Record<string, IAudioManifestEntry>;

export type AudioKey = keyof typeof AUDIO_PATHS;
