import * as THREE from 'three';
import type { INextLevelFlyby, ITextDisplay } from '../../config/interfaces/interfaces';
import type { VoxelFont } from './VoxelFont';
import { VoxelText } from './VoxelText';
import { placeTextInFrontOfCamera } from './placeText';

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const easeInCubic = (t: number): number => t ** 3;

/**
 * Voxel text that zooms in along world Z from behind the camera, pauses, then zooms off toward the horizon.
 * It is placed like the display says (so X, Y, orientation and look match e.g. GAME OVER), and only its Z moves.
 * It owns its own timing, independent of the game; call update() each frame until it returns true, which means
 * it has been removed from the scene.
 */
export class TextFlyby {
    private readonly text: VoxelText;
    private readonly startZ: number;
    private readonly config: INextLevelFlyby;
    private elapsed = 0;
    private finished = false;

    constructor(font: VoxelFont, scene: THREE.Scene, camera: THREE.Camera, display: ITextDisplay, config: INextLevelFlyby) {
        this.config = config;
        this.text = new VoxelText(font, display);
        this.text.setText(display.text);
        placeTextInFrontOfCamera(this.text, camera, display);
        this.startZ = camera.position.z - config.startBehindCamera;
        this.text.group.position.z = this.startZ;
        scene.add(this.text.group);
    }

    /** Advances the flyby; returns true once it is finished and removed. */
    public update(dt: number): boolean {
        if (this.finished) return true;
        const { approachSeconds, pauseSeconds, departSeconds, pauseZ, endZ } = this.config;
        this.elapsed += dt;

        let z: number;
        if (this.elapsed < approachSeconds) {
            z = THREE.MathUtils.lerp(this.startZ, pauseZ, easeOutCubic(this.elapsed / approachSeconds));
        } else if (this.elapsed < approachSeconds + pauseSeconds) {
            z = pauseZ;
        } else {
            const t = departSeconds > 0 ? (this.elapsed - approachSeconds - pauseSeconds) / departSeconds : 1;
            if (t >= 1) {
                this.dispose();
                return true;
            }
            z = THREE.MathUtils.lerp(pauseZ, endZ, easeInCubic(t));
        }
        this.text.group.position.z = z;
        return false;
    }

    public dispose(): void {
        this.finished = true;
        this.text.dispose();
    }
}
