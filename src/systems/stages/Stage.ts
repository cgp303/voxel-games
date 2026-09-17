// systems/stages/Stage.ts

import { PatternDirector } from "../patterns/interfaces";

export class Stage {
    name: string;
    director: PatternDirector;   // Updated to use the PatternDirector interface
    directorConfig: Record<string, any>;
    fireRate: number;
    missileStrength: number;
    backgroundAsset: string | null;

    constructor(
        name: string,
        director: PatternDirector,
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
