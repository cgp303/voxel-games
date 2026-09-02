import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameScene } from './Scene';
import { GameCamera } from './Camera';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { VIEW } from '../data/constants';
import {
    applyFitRect,
    applyUiScale,
    fitContain,
    getGameFrame,
    getUiRoot,
    viewAspect,
} from '../core/viewport';

export class GameRenderer {
    public renderer: THREE.WebGLRenderer;
    private scene: GameScene;
    private camera: GameCamera | null = null;
    private composer: EffectComposer | null = null;
    private animationId: number | null = null;
    private readonly gameFrame: HTMLElement;
    private readonly uiRoot: HTMLElement;
    private fxaaPass: ShaderPass | null = null;

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

        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(
            this.scene.scene,
            this.camera?.camera || new THREE.Camera(),
        );
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(VIEW.internalWidth, VIEW.internalHeight),
            0.2,
            1.0,
            0.2,
        );
        this.composer.addPass(bloomPass);

        this.fxaaPass = new ShaderPass(FXAAShader);
        this.fxaaPass.uniforms['resolution'].value.x = 1 / VIEW.internalWidth;
        this.fxaaPass.uniforms['resolution'].value.y = 1 / VIEW.internalHeight;
        this.composer.addPass(this.fxaaPass);

        this.composer.setSize(VIEW.internalWidth, VIEW.internalHeight);

        // Initial contain-fit (App also calls on resize)
        this.applyFrameToWindow();
    }

    public setCamera(camera: GameCamera) {
        this.camera = camera;
        if (this.composer) {
            const renderPass = this.composer.passes[0] as RenderPass;
            renderPass.camera = camera.camera;
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
        if (this.camera) {
            this.camera.update();
            this.composer?.render();
        }
    }

    /**
     * @deprecated Prefer core/Engine for the game loop (Phase 0+).
     * Kept for legacy/debug; App must not call this alongside Engine.
     */
    public startAnimation() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.render();
        };
        animate();
    }

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
