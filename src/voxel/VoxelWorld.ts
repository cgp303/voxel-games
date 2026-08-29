export interface Voxel {
    x: number;
    y: number;
    z: number;
    colorIndex: number;
}

export interface VoxelBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}

export class VoxelWorld {
    private voxels: Map<string, Voxel> = new Map();
    private bounds: VoxelBounds = {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        minZ: 0,
        maxZ: 0,
    };

    constructor() { }

    private getKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }

    public setVoxel(x: number, y: number, z: number, colorIndex: number) {
        const key = this.getKey(x, y, z);
        this.voxels.set(key, { x, y, z, colorIndex });
        this.updateBounds(x, y, z);
    }

    public getVoxel(x: number, y: number, z: number): Voxel | undefined {
        const key = this.getKey(x, y, z);
        return this.voxels.get(key);
    }

    public removeVoxel(x: number, y: number, z: number) {
        const key = this.getKey(x, y, z);
        this.voxels.delete(key);
    }

    public getAllVoxels(): Voxel[] {
        return Array.from(this.voxels.values());
    }

    public clear() {
        this.voxels.clear();
        this.bounds = {
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0,
            minZ: 0,
            maxZ: 0,
        };
    }

    public getBounds(): VoxelBounds {
        return this.bounds;
    }

    public getVoxelCount(): number {
        return this.voxels.size;
    }

    private updateBounds(x: number, y: number, z: number) {
        this.bounds.minX = Math.min(this.bounds.minX, x);
        this.bounds.maxX = Math.max(this.bounds.maxX, x + 1);
        this.bounds.minY = Math.min(this.bounds.minY, y);
        this.bounds.maxY = Math.max(this.bounds.maxY, y + 1);
        this.bounds.minZ = Math.min(this.bounds.minZ, z);
        this.bounds.maxZ = Math.max(this.bounds.maxZ, z + 1);
    }
}
