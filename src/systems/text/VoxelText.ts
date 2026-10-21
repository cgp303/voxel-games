import * as THREE from 'three';
import { FX, INVADER_MESH_MATERIAL, TEXT } from '../../config/data/constants';
import type { IVoxelCloud, IVoxelTextStyle } from '../../config/interfaces/interfaces';
import type { DebrisSystem } from '../fx/DebrisSystem';
import { bloomPass } from '../fx/bloomPass';
import type { IGlyph, VoxelFont } from './VoxelFont';

interface IPlacedChar {
    mesh: THREE.Mesh;
    glyph: IGlyph;
    exploded: boolean;
}

const NO_VELOCITY = { x: 0, y: 0, z: 0 };

/**
 * A string drawn from the voxel font. Every character is its own mesh (they share the font's cached
 * geometry), so letters can be animated or exploded one at a time. Place and orient `group` in the scene.
 * Text sits on TEXT.layer (so it is bloomed) and is a real world object: it is lit like the invaders and
 * depth-tested, so terrain can hide it if it is placed underground, and its letters cast and receive shadows.
 * Text is centred on the group's origin and faces the group's +Z axis; +X is the reading direction.
 * It is drawn at `brightness` times its colour; `glowIntensity` separately scales the colour fed to the bloom pass.
 */
export class VoxelText {
    public readonly group = new THREE.Group();

    private readonly font: VoxelFont;
    // A clone of the invader material (lit, double-sided); cloned because its colour is changed per pass.
    private readonly material = INVADER_MESH_MATERIAL.clone();
    private readonly baseColor = new THREE.Color();
    private readonly scale: number;
    private readonly letterGap: number;
    private readonly glowIntensity: number;
    private readonly brightness: number;
    private readonly castShadow: boolean;
    private chars: IPlacedChar[] = [];

    // Scratch values for explodeChar().
    private readonly centre = new THREE.Vector3();
    private readonly orientation = new THREE.Quaternion();

    constructor(font: VoxelFont, style: IVoxelTextStyle) {
        this.font = font;
        this.scale = style.scale;
        this.letterGap = style.letterGap ?? TEXT.letterGap;
        this.glowIntensity = style.glowIntensity;
        this.brightness = style.brightness;
        this.castShadow = style.castShadow ?? true;
        this.group.name = 'VoxelText';
        this.group.scale.setScalar(this.scale);
        this.setColor(style.color);
    }

    /** Number of visible-glyph characters (spaces and characters missing from the font do not count). */
    public get charCount(): number {
        return this.chars.length;
    }

    public setColor(color: THREE.ColorRepresentation): void {
        this.baseColor.set(color);
        this.material.color.copy(this.baseColor).multiplyScalar(this.brightness);
    }

    /** Runs before each character is drawn: `brightness` on screen, `glowIntensity` in the bloom pass. */
    private readonly applyPassColor = (): void => {
        this.material.color.copy(this.baseColor).multiplyScalar(bloomPass.active ? this.glowIntensity : this.brightness);
    };

    /** Width in voxels of `text` as setText() lays it out (spaces and characters the font lacks included). */
    public static measure(font: VoxelFont, text: string, letterGap: number = TEXT.letterGap): number {
        return VoxelText.layout(font, text, letterGap).width;
    }

    /** Where each drawable character of `text` starts (voxels from the line's left end), and the line's width. */
    private static layout(font: VoxelFont, text: string, letterGap: number): { items: { glyph: IGlyph; x: number }[]; width: number } {
        const items: { glyph: IGlyph; x: number }[] = [];
        let cursor = 0;
        for (const char of text) {
            const glyph = font.get(char);
            if (!glyph) {
                if (char === ' ') cursor += TEXT.spaceWidth;
                continue;
            }
            items.push({ glyph, x: cursor });
            cursor += glyph.width + letterGap;
        }
        // The cursor includes the gap after the last glyph.
        return { items, width: cursor - letterGap };
    }

    /** Replaces the text. Spaces advance the cursor; characters the font lacks are skipped. */
    public setText(text: string): void {
        this.clearChars();

        const { items, width } = VoxelText.layout(this.font, text, this.letterGap);
        for (const { glyph, x } of items) {
            const mesh = new THREE.Mesh(glyph.geometry, this.material);
            // Centre the line on the group origin.
            mesh.position.set(x - width / 2, -TEXT.cellHeight / 2, 0);
            mesh.castShadow = this.castShadow;
            mesh.receiveShadow = true;
            mesh.layers.set(FX.enabled ? TEXT.layer : 0);
            mesh.frustumCulled = false;
            mesh.onBeforeRender = this.applyPassColor;
            this.group.add(mesh);
            this.chars.push({ mesh, glyph, exploded: false });
        }
    }

    /**
     * Hides one character and breaks it into debris. Returns the longest debris lifetime (s),
     * or 0 when the character was already exploded or the index is out of range.
     */
    public explodeChar(index: number, debris: DebrisSystem): number {
        const placed = this.chars[index];
        if (!placed || placed.exploded) return 0;
        placed.exploded = true;
        placed.mesh.visible = false;

        this.group.updateWorldMatrix(true, true);
        placed.mesh.localToWorld(this.centre.set(placed.glyph.centre.x, placed.glyph.centre.y, placed.glyph.centre.z));
        this.group.getWorldQuaternion(this.orientation);
        return debris.explode('text', this.tintedCloud(placed.glyph.cloud), this.centre, this.orientation, NO_VELOCITY);
    }

    /**
     * Every voxel of the characters still intact, as world-space centres (x/y/z) coloured as the text is drawn
     * on screen. Voxels are `voxelSize` world units wide and share the group's world orientation.
     */
    public worldVoxelCloud(): IVoxelCloud {
        this.group.updateWorldMatrix(true, true);
        let count = 0;
        for (const { glyph, exploded } of this.chars) if (!exploded) count += glyph.cloud.count;

        const x = new Float32Array(count);
        const y = new Float32Array(count);
        const z = new Float32Array(count);
        let n = 0;
        for (const { mesh, glyph, exploded } of this.chars) {
            if (exploded) continue;
            const { cloud, centre } = glyph;
            for (let i = 0; i < cloud.count; i++, n++) {
                this.centre.set(centre.x + cloud.x[i], centre.y + cloud.y[i], centre.z + cloud.z[i]).applyMatrix4(mesh.matrixWorld);
                x[n] = this.centre.x;
                y[n] = this.centre.y;
                z[n] = this.centre.z;
            }
        }
        const drawn = (channel: number): Float32Array => new Float32Array(count).fill(channel * this.brightness);
        return { count, x, y, z, r: drawn(this.baseColor.r), g: drawn(this.baseColor.g), b: drawn(this.baseColor.b) };
    }

    /** World units per voxel. */
    public get voxelSize(): number {
        return this.scale;
    }

    public setVisible(visible: boolean): void {
        this.group.visible = visible;
    }

    public dispose(): void {
        this.clearChars();
        this.group.removeFromParent();
        this.material.dispose();
    }

    /** The glyph's offsets in world units, coloured with the text colour (the font's own voxels are white). */
    private tintedCloud(cloud: IVoxelCloud): IVoxelCloud {
        const scaled = (source: Float32Array): Float32Array => source.map((v) => v * this.scale);
        const filled = (value: number): Float32Array => new Float32Array(cloud.count).fill(value);
        return {
            count: cloud.count,
            x: scaled(cloud.x),
            y: scaled(cloud.y),
            z: scaled(cloud.z),
            r: filled(this.baseColor.r),
            g: filled(this.baseColor.g),
            b: filled(this.baseColor.b),
        };
    }

    private clearChars(): void {
        for (const { mesh } of this.chars) this.group.remove(mesh);
        this.chars = [];
    }
}
