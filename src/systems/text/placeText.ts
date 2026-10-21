import * as THREE from 'three';
import type { ITextDisplay } from '../../config/interfaces/interfaces';

const forward = new THREE.Vector3();
const axis = new THREE.Vector3();
const euler = new THREE.Euler();

/** The part of a text display that says where it goes. */
export type ITextPlacement = Pick<ITextDisplay, 'cameraDistance' | 'offsetX' | 'offsetY' | 'pitch'>;

/**
 * Positions text in front of a (locked) camera as its display settings describe: `cameraDistance` along the
 * view, shifted by `offsetX`/`offsetY` along the camera's right/up axes.
 * With no `pitch` the text faces the camera squarely. With a `pitch` it stands on the world instead
 * (0 upright, 90 flat face-up), turned to face the camera's heading so it still reads left to right.
 * Works on anything with a `group`: a VoxelText or a VoxelTextBlock.
 */
export function placeTextInFrontOfCamera(text: { group: THREE.Object3D }, camera: THREE.Camera, display: ITextPlacement): void {
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);

    const position = text.group.position.copy(camera.position);
    position.addScaledVector(forward, display.cameraDistance);
    position.addScaledVector(axis.set(1, 0, 0).applyQuaternion(camera.quaternion), display.offsetX);
    position.addScaledVector(axis.set(0, 1, 0).applyQuaternion(camera.quaternion), display.offsetY);

    if (display.pitch === undefined) {
        text.group.quaternion.copy(camera.quaternion);
        return;
    }
    // Yaw so the text's front (+Z) points back at the camera, then tilt it about its own X (reading) axis.
    const yaw = Math.atan2(forward.x, forward.z) + Math.PI;
    text.group.quaternion.setFromEuler(euler.set(-THREE.MathUtils.degToRad(display.pitch), yaw, 0, 'YXZ'));
}
