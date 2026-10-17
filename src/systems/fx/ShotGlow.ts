import type { InstancedMesh, MeshStandardMaterial } from 'three';
import { FX } from '../../config/data/constants';

/** Meshes whose FX material has already been prepared (meshes are cached across sessions). */
const preparedMeshes = new WeakSet<InstancedMesh>();

/** Puts a shot mesh on the bloom layer with an emissive material of its own (once per mesh). */
export function applyShotGlow(mesh: InstancedMesh): void {
    if (!FX.enabled || preparedMeshes.has(mesh)) return;
    preparedMeshes.add(mesh);
    // Only the FX layer is bloomed; the material is cloned so meshes sharing the source material do not glow.
    mesh.layers.set(FX.layer);
    const material = (mesh.material as MeshStandardMaterial).clone();
    material.emissive.setRGB(1, 1, 1);
    material.emissiveIntensity = FX.shotEmissiveIntensity;
    mesh.material = material;
}
