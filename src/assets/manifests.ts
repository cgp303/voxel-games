/** Asset path keys used by AssetManager (Phase 2+) */
// Assets are served from public/assets/vox/
export const ASSET_PATHS = {
    invader: 'assets/vox/inv10.vox',
    invader1: 'assets/vox/inv7.vox',
    invader2: 'assets/vox/inv9.vox',
    invader3: 'assets/vox/inv8.vox',
    player: 'assets/vox/player.vox',
    lazer: 'assets/vox/lazer1.vox',
    mine: 'assets/vox/bomb1.vox',
    minehit1: 'assets/vox/bomb1hit1.vox',
    minehit2: 'assets/vox/bomb1hit2.vox',
    invlazer1: 'assets/vox/inv-lazer1.vox',
    invlazer2: 'assets/vox/inv-lazer2.vox',

} as const;

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
