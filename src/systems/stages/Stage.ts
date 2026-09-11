// systems/stages/Stage.ts

export class Stage {
    name: string;
    director: any;               // You can tighten this later with a Director interface
    directorConfig: Record<string, any>;
    fireRate: number;
    missileStrength: number;
    backgroundAsset: string | null;

    constructor(
        name: string,
        director: any,
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
