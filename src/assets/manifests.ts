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
    invader4: { src: 'assets/vox/inv11.vox', preload: true },
    invader5: { src: 'assets/vox/inv12.vox', preload: true },
    invader6: { src: 'assets/vox/inv13.vox', preload: true },
    invader7: { src: 'assets/vox/invGreen1.vox', preload: true },
    invader8: { src: 'assets/vox/invGreen2.vox', preload: true },
    player: { src: 'assets/vox/player.vox', preload: true },
    lazer: { src: 'assets/vox/lazer1.vox', preload: true },

    mine: { src: 'assets/vox/bomb1.vox', preload: true },
    minehit1: { src: 'assets/vox/bomb1hit1.vox', preload: true },
    minehit2: { src: 'assets/vox/bomb1hit2.vox', preload: true },
    mine2: { src: 'assets/vox/bomb2.vox', preload: true },
    mine2hit1: { src: 'assets/vox/bomb2hit1.vox', preload: true },
    mine2hit2: { src: 'assets/vox/bomb2hit2.vox', preload: true },

    invlazer1: { src: 'assets/vox/inv-lazer1.vox', preload: true },
    invlazer2: { src: 'assets/vox/inv-lazer2.vox', preload: true },
    // Hand-authored terrain tiles: 32 x 8 x 32 voxels each, placed by a style in config/data (see world/terrain)
    // Ataria-1 terrain tiles
    terrainAtaria1_0: { src: 'assets/vox/terrains/ataria-1/ataria-1-0.vox', preload: true },
    terrainAtaria1_1: { src: 'assets/vox/terrains/ataria-1/ataria-1-1.vox', preload: true },
    terrainAtaria1_2: { src: 'assets/vox/terrains/ataria-1/ataria-1-2.vox', preload: true },
    terrainAtaria1_7: { src: 'assets/vox/terrains/ataria-1/ataria-1-7.vox', preload: true },

    // Hand-authored terrain tiles: 32 x 8 x 32 voxels each, placed by a style in config/data (see world/terrain)
    // green world terrain tiles
    terrainGreenWorld_1: { src: 'assets/vox/terrains/greenworld/greenworld-1.vox', preload: true },
    terrainGreenWorld_2: { src: 'assets/vox/terrains/greenworld/greenworld-2.vox', preload: true },
    terrainGreenWorld_3: { src: 'assets/vox/terrains/greenworld/greenworld-3.vox', preload: true },
    terrainGreenWorld_4: { src: 'assets/vox/terrains/greenworld/greenworld-4.vox', preload: true },
    terrainGreenWorld_0a: { src: 'assets/vox/terrains/greenworld/greenworld-0a.vox', preload: true },
    terrainGreenWorld_0b: { src: 'assets/vox/terrains/greenworld/greenworld-0b.vox', preload: true },
    terrainGreenWorld_0c: { src: 'assets/vox/terrains/greenworld/greenworld-0c.vox', preload: true },
    terrainGreenWorld_7a: { src: 'assets/vox/terrains/greenworld/greenworld-7a.vox', preload: true },
    terrainGreenWorld_7b: { src: 'assets/vox/terrains/greenworld/greenworld-7b.vox', preload: true },
    terrainGreenWorld_7c: { src: 'assets/vox/terrains/greenworld/greenworld-7c.vox', preload: true },
    terrainGreenWorld_1a: { src: 'assets/vox/terrains/greenworld/greenworld-1a.vox', preload: true },
    // grey world terrain tiles
    terrainGreyWorld_1: { src: 'assets/vox/terrains/greyworld/greyworld-1.vox', preload: true },
    terrainGreyWorld_1a: { src: 'assets/vox/terrains/greyworld/greyworld-1a.vox', preload: true },
    terrainGreyWorld_2: { src: 'assets/vox/terrains/greyworld/greyworld-2.vox', preload: true },
    terrainGreyWorld_2a: { src: 'assets/vox/terrains/greyworld/greyworld-2a.vox', preload: true },
    terrainGreyWorld_2b: { src: 'assets/vox/terrains/greyworld/greyworld-2b.vox', preload: true },
    terrainGreyWorld_2c: { src: 'assets/vox/terrains/greyworld/greyworld-2c.vox', preload: true },
    // neon world terrain tiles
    terrainNeonWorld_1: { src: 'assets/vox/terrains/neonworld/neonworld-1.vox', preload: true },
    terrainNeonWorld_2: { src: 'assets/vox/terrains/neonworld/neonworld-2.vox', preload: true },
    terrainNeonWorld_3: { src: 'assets/vox/terrains/neonworld/neonworld-3.vox', preload: true },
    terrainNeonWorld_4: { src: 'assets/vox/terrains/neonworld/neonworld-4.vox', preload: true },
    terrainNeonWorld_5: { src: 'assets/vox/terrains/neonworld/neonworld-5.vox', preload: true },
    terrainNeonWorld_7: { src: 'assets/vox/terrains/neonworld/neonworld-7.vox', preload: true },
    terrainNeonWorld_8: { src: 'assets/vox/terrains/neonworld/neonworld-8.vox', preload: true },
    terrainNeonWorld_9: { src: 'assets/vox/terrains/neonworld/neonworld-9.vox', preload: true },
    terrainNeonWorld_10: { src: 'assets/vox/terrains/neonworld/neonworld-10.vox', preload: true },
    terrainNeonWorld_11: { src: 'assets/vox/terrains/neonworld/neonworld-11.vox', preload: true },
    terrainNeonWorld_12: { src: 'assets/vox/terrains/neonworld/neonworld-12.vox', preload: true },


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
    playerFiresLazer: { src: 'assets/audio/player-lazer.mp3', volume: 0.1, loop: false, preload: true },
    playerDied: { src: 'assets/audio/player-explosion.mp3', volume: 1, loop: false, preload: true },
    gameStart: { src: 'assets/audio/game-start-jingle.mp3', volume: 0.7, loop: false, preload: true },
    gameOver: { src: 'assets/audio/gameover-a.mp3', volume: 1, loop: false, preload: true },
    gameOverAssembly: { src: 'assets/audio/gameover-assembly.mp3', volume: 0.6, loop: false, preload: true },
    gameOverExplosion: { src: 'assets/audio/gameover-explosion.mp3', volume: 1, loop: false, preload: true },
    invaderLazerA: { src: 'assets/audio/invader-lazer1d.mp3', volume: 1, loop: false, preload: true },
    invaderKilled: { src: 'assets/audio/invader-explosion.mp3', volume: 0.25, loop: false, preload: true },
    mineDestroyed: { src: 'assets/audio/mine-explosion.mp3', volume: 0.15, loop: false, preload: true },
    mineHit: { src: 'assets/audio/mine-clonk.mp3', volume: 0.15, loop: false, preload: true },
    mineHit2: { src: 'assets/audio/mine-clonk.mp3', volume: 0.15, loop: false, preload: true },
    nextWave: { src: 'assets/audio/next-wave.mp3', volume: 1, loop: false, preload: true },
    bossWave: { src: 'assets/audio/boss-wave.mp3', volume: 1, loop: false, preload: true },
    boss1Bomb: { src: 'assets/audio/boss1-bomb.mp3', volume: 1, loop: false, preload: true },
    boss1PartDestroyed: { src: 'assets/audio/boss1-part-explosion.mp3', volume: 1, loop: false, preload: true },
    boss1PartFallsOff: { src: 'assets/audio/boss1-part-drops-off.mp3', volume: 1, loop: false, preload: true },
    boss1Explosion: { src: 'assets/audio/boss1-explosion.mp3', volume: 1, loop: false, preload: true },
    // ogg
    mineActivated: { src: 'assets/audio/mine-loop1.ogg', volume: 0.03, loop: true, preload: true },
    boss1LazerOn: { src: 'assets/audio/boss1-lazers.ogg', volume: 1, loop: true, preload: true },
    astroForcePsy: { src: 'assets/audio/astro-force-psy.ogg', volume: 0.7, loop: true, preload: true },
    astroInGame: { src: 'assets/audio/astro-force-game-track.ogg', volume: 0.4, loop: true, preload: true },

} as const satisfies Record<string, IAudioManifestEntry>;

export type AudioKey = keyof typeof AUDIO_PATHS;
