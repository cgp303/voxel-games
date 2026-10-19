import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameScene } from './Scene';
import { GameCamera } from './Camera';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { FX, TEXT, VIEW } from '../config/data/constants';
import { bloomPass } from '../systems/fx/bloomPass';
import {
    applyFitRect,
    applyUiScale,
    fitContain,
    getGameFrame,
    getUiRoot,
    viewAspect,
} from '../core/viewport';

/** Adds the blurred bloom buffer onto the scene colour. */
const BloomMixShader = {
    uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        tBloom: { value: null as THREE.Texture | null },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        varying vec2 vUv;
        void main() {
            gl_FragColor = texture2D(tDiffuse, vUv) + texture2D(tBloom, vUv);
        }`,
};

export class GameRenderer {
    public renderer: THREE.WebGLRenderer;
    private scene: GameScene;
    private camera: GameCamera | null = null;
    private composer: EffectComposer | null = null;
    private animationId: number | null = null;
    private readonly gameFrame: HTMLElement;
    private readonly uiRoot: HTMLElement;
    private fxaaPass: ShaderPass | null = null;

    // Selective bloom (only active when FX.enabled): the bloom pass draws just the FX layer.
    private bloomComposer: EffectComposer | null = null;
    private bloomRenderPass: RenderPass | null = null;
    private bloomMixPass: ShaderPass | null = null;

    constructor(scene: GameScene, camera: GameCamera | null = null) {
        this.scene = scene;
        this.camera = camera;

        this.gameFrame = getGameFrame();
        this.uiRoot = getUiRoot();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        // Fixed internal resolution; CSS scales the canvas to the fitted frame.
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(VIEW.internalWidth, VIEW.internalHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Canvas behind UI root inside the framed stage
        this.gameFrame.insertBefore(this.renderer.domElement, this.uiRoot);

        if (FX.enabled) {
            this.composer = new EffectComposer(this.renderer);
            this.composer.addPass(new RenderPass(this.scene.scene, this.camera?.camera || new THREE.Camera()));
            this.buildBloomPasses();
            this.fxaaPass = new ShaderPass(FXAAShader);
            this.fxaaPass = new ShaderPass(FXAAShader);
            this.fxaaPass.uniforms['resolution'].value.x = 1 / VIEW.internalWidth;
            this.fxaaPass.uniforms['resolution'].value.y = 1 / VIEW.internalHeight;
            this.composer.addPass(this.fxaaPass);

            this.composer.setSize(VIEW.internalWidth, VIEW.internalHeight);
            this.buildBloomPasses();
        }

        if (this.camera) this.prepareCamera(this.camera.camera);

        // Initial contain-fit (App also calls on resize)
        this.applyFrameToWindow();
    }

    public setCamera(camera: GameCamera) {
        this.camera = camera;
        this.prepareCamera(camera.camera);
        if (this.composer) {
            const renderPass = this.composer.passes[0] as RenderPass;
            renderPass.camera = camera.camera;
        }
        if (this.bloomRenderPass) {
            this.bloomRenderPass.camera = camera.camera;
        }
    }

    /**
     * Contain-fit #game-frame in the window and scale #ui-root to design res.
     * Does not change the WebGL buffer size (stays VIEW.internal*).
     */
    public applyFrameToWindow(
        windowW: number = window.innerWidth,
        windowH: number = window.innerHeight,
    ): void {
        const fit = fitContain(windowW, windowH, viewAspect());
        applyFitRect(this.gameFrame, fit);
        applyUiScale(this.uiRoot, fit);
        document.body.style.background = VIEW.bezelColor;
    }

    /** @deprecated Use applyFrameToWindow — internal buffer is fixed. */
    public onWindowResize() {
        this.applyFrameToWindow();
    }

    public render() {
        if (!this.camera) return;
        this.camera.update();
        if (this.composer) {
            if (this.bloomComposer && this.bloomMixPass) {
                this.renderBloomBuffer(this.bloomComposer, this.bloomMixPass);
            }
            this.composer.render();
        } else {
            this.renderer.render(this.scene.scene, this.camera.camera);
        }
    }

    /** Builds the bloom composer and the mix pass that adds its result into the main composer. */
    private buildBloomPasses(): void {
        const width = Math.round(VIEW.internalWidth * FX.bloom.resolutionScale);
        const height = Math.round(VIEW.internalHeight * FX.bloom.resolutionScale);

        this.bloomComposer = new EffectComposer(this.renderer);
        this.bloomComposer.renderToScreen = false;
        this.bloomComposer.setSize(width, height);
        this.bloomRenderPass = new RenderPass(
            this.scene.scene,
            this.camera?.camera || new THREE.Camera(),
        );
        this.bloomComposer.addPass(this.bloomRenderPass);
        this.bloomComposer.addPass(
            new UnrealBloomPass(
                new THREE.Vector2(width, height),
                FX.bloom.strength,
                FX.bloom.radius,
                0,
            ),
        );

        this.bloomMixPass = new ShaderPass(BloomMixShader);
        this.composer?.addPass(this.bloomMixPass);
    }

    /** Lets the camera see the FX and text layers (shots, debris and text live there when FX is on). */
    private prepareCamera(camera: THREE.Camera): void {
        if (FX.enabled) {
            camera.layers.enable(FX.layer);
            camera.layers.enable(TEXT.layer);
        }
    }

    /**
     * Renders the glow sources into the bloom buffer. Only the FX and text layers are drawn: the camera is limited
     * to them for this pass, so terrain, invaders and the player are neither drawn nor swapped to a dark material.
     * Three's shadow pass also honours the camera's layers, so the shadow map is not redrawn for this pass either.
     * The background and fog are removed so only the FX meshes add light.
     */
    private renderBloomBuffer(bloomComposer: EffectComposer, mixPass: ShaderPass): void {
        const camera = this.camera?.camera;
        if (!camera) return;
        const scene = this.scene.scene;

        const layerMask = camera.layers.mask;
        camera.layers.set(FX.layer);
        camera.layers.enable(TEXT.layer);

        const background = scene.background;
        const fog = scene.fog;
        scene.background = null;
        scene.fog = null;
        bloomPass.active = true;
        bloomComposer.render();
        bloomPass.active = false;
        scene.background = background;
        scene.fog = fog;

        camera.layers.mask = layerMask;
        mixPass.uniforms.tBloom.value = bloomComposer.readBuffer.texture;
    }

    // /**
    //  * @deprecated Prefer core/Engine for the game loop (Phase 0+).
    //  * Kept for legacy/debug; App must not call this alongside Engine.
    //  */
    // public startAnimation() {
    //     const animate = () => {
    //         this.animationId = requestAnimationFrame(animate);
    //         this.render();
    //     };
    //     animate();
    // }

    public stopAnimation() {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public getDOMElement(): HTMLCanvasElement {
        return this.renderer.domElement as HTMLCanvasElement;
    }

    public getUiRoot(): HTMLElement {
        return this.uiRoot;
    }
}
