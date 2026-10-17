/** Asset path keys used by AssetManager (Phase 2+) */
export const ASSET_PATHS = {
    invader: 'assets/vox/inv10.vox',
    // invader1: 'assets/vox/galagaInv1.vox',
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
