/** Asset path keys used by AssetManager (Phase 2+) */
export const ASSET_PATHS = {
    invader: 'assets/vox/inv5.vox',
    // invader1: 'assets/vox/galagaInv1.vox',
    invader1: 'assets/vox/inv7.vox',
} as const;

export type AssetKey = keyof typeof ASSET_PATHS;
