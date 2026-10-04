// systems/stages/Stage.ts

import { IPatternDirector } from "../../config/interfaces/interfaces";

export class Stage {
    name: string;
    director: IPatternDirector;   // Updated to use the PatternDirector interface
    directorConfig: Record<string, any>;
    fireRate: number;
    missileStrength: number;
    backgroundAsset: string | null;

    constructor(
        name: string,
        director: IPatternDirector,
        directorConfig: Record<string, any> = {},
        fireRate: number = 1.0,
        missileStrength: number = 1.0,
        backgroundAsset: string | null = null
    ) {
        this.name = name;
        this.director = director;
        this.directorConfig = directorConfig;
        this.fireRate = fireRate;
        this.missileStrength = missileStrength;
        this.backgroundAsset = backgroundAsset;
    }
}
