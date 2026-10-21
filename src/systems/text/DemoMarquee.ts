import * as THREE from 'three';
import type { IMarqueeStyle } from '../../config/interfaces/interfaces';
import type { VoxelFont } from './VoxelFont';
import { VoxelTextBlock } from './VoxelTextBlock';
import { placeTextInFrontOfCamera } from './placeText';

/** One display of the sequence. `lines` is read each time the display starts, so its content can change between loops. */
export interface IMarqueeSlide {
    style: IMarqueeStyle;
    lines: () => readonly string[];
}

export interface IMarqueeSequenceConfig {
    /** A slide starts the next one when it passes this world Z. */
    nextSlideZ: number;
    /** A new slide starts this far behind the camera in Z (world units). */
    startBehindCamera: number;
}

interface IActiveSlide {
    index: number;
    block: VoxelTextBlock;
    style: IMarqueeStyle;
    z: number;
    /** Z at which the slide's near edge is lost in the fog and it is removed. */
    endZ: number;
    age: number;
    triggeredNext: boolean;
    stopped: boolean;
    holdLeft: number;
    hue: { h: number; s: number; l: number };
}

const hslScratch = { h: 0, s: 0, l: 0 };
const colorScratch = new THREE.Color();

/**
 * Plays flat voxel-text displays in turn. Each emerges from behind the camera and creeps along world Z
 * toward the horizon (at the X, Y and orientation its style gives). When it passes `nextSlideZ` the next
 * slide starts, wrapping round after the last, so the sequence loops forever. A slide with a `stopZ` halts
 * there for `holdSeconds`. A slide is removed once it is lost in the fog.
 * Slides are assumed to lie flat (pitch 90), so a block's height runs along Z.
 */
export class DemoMarquee {
    private readonly active: IActiveSlide[] = [];
    private readonly font: VoxelFont;
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.Camera;
    private readonly slides: readonly IMarqueeSlide[];
    private readonly config: IMarqueeSequenceConfig;

    constructor(
        font: VoxelFont,
        scene: THREE.Scene,
        camera: THREE.Camera,
        slides: readonly IMarqueeSlide[],
        config: IMarqueeSequenceConfig,
    ) {
        this.font = font;
        this.scene = scene;
        this.camera = camera;
        this.slides = slides;
        this.config = config;
    }

    /** Begins the sequence from the first slide, dropping any slides already showing. */
    public start(): void {
        this.clear();
        this.spawn(0);
    }

    public update(dt: number): void {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const slide = this.active[i];
            this.advance(slide, dt);

            if (!slide.triggeredNext && slide.z >= this.config.nextSlideZ) {
                slide.triggeredNext = true;
                this.spawn((slide.index + 1) % this.slides.length);
            }

            if (slide.z - slide.block.height / 2 >= slide.endZ) {
                slide.block.dispose();
                this.active.splice(i, 1);
            }
        }
    }

    public dispose(): void {
        this.clear();
    }

    private clear(): void {
        for (const slide of this.active) slide.block.dispose();
        this.active.length = 0;
    }

    private advance(slide: IActiveSlide, dt: number): void {
        const { style } = slide;
        slide.age += dt;

        if (slide.holdLeft > 0) {
            slide.holdLeft -= dt;
        } else {
            slide.z += style.speedZ * dt;
            if (!slide.stopped && style.stopZ !== undefined && slide.z >= style.stopZ) {
                slide.z = style.stopZ;
                slide.stopped = true;
                slide.holdLeft = style.holdSeconds ?? 0;
            }
        }
        slide.block.group.position.z = slide.z;

        if (style.hueCycleSeconds) {
            const { h, s, l } = slide.hue;
            colorScratch.setHSL((h + slide.age / style.hueCycleSeconds) % 1, s, l, THREE.SRGBColorSpace);
            slide.block.setColor(colorScratch);
        }
    }

    private spawn(index: number): void {
        const { style, lines } = this.slides[index];
        const block = new VoxelTextBlock(this.font, style, lines(), style.lineHeight);
        placeTextInFrontOfCamera(block, this.camera, style);
        this.scene.add(block.group);

        const z = this.camera.position.z - this.config.startBehindCamera - block.height / 2;
        block.group.position.z = z;

        const fogFar = this.scene.fog instanceof THREE.Fog ? this.scene.fog.far : 1000;
        const hue = { ...new THREE.Color(style.color).getHSL(hslScratch, THREE.SRGBColorSpace) };
        this.active.push({
            index,
            block,
            style,
            z,
            endZ: this.camera.position.z + fogFar,
            age: 0,
            triggeredNext: false,
            stopped: false,
            holdLeft: 0,
            hue,
        });
    }
}
