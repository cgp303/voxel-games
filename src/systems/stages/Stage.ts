// systems/stages/Stage.ts

import { IPatternDirector, IWeaponOverrides } from "../../config/interfaces/interfaces";
import { checkWeaponOverrides } from "../weapons/WeaponTriggers";

export class Stage {
    name: string;
    director: IPatternDirector;   // Updated to use the PatternDirector interface
    directorConfig: Record<string, any>;
    fireRate: number;
    missileStrength: number;
    backgroundAsset: string | null;
    /** Replaces INVADER_WEAPONS settings (drop chance per segment, maxPerAttack, ...) while this stage runs. */
    weaponOverrides: IWeaponOverrides;

    constructor(
        name: string,
        director: IPatternDirector,
        directorConfig: Record<string, any> = {},
        fireRate: number = 1.0,
        missileStrength: number = 1.0,
        backgroundAsset: string | null = null,
        weaponOverrides: IWeaponOverrides = {}
    ) {
        checkWeaponOverrides(weaponOverrides);
        this.name = name;
        this.director = director;
        this.directorConfig = directorConfig;
        this.fireRate = fireRate;
        this.missileStrength = missileStrength;
        this.backgroundAsset = backgroundAsset;
        this.weaponOverrides = weaponOverrides;
    }
}
