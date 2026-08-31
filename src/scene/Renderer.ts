import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameScene } from './Scene';
import { GameCamera } from './Camera';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export class GameRenderer {
    public renderer: THREE.WebGLRenderer;
    private scene: GameScene;
    private camera: GameCamera | null = null;  // Make it nullable
    private composer: EffectComposer | null = null;
    private animationId: number | null = null;

    constructor(scene: GameScene, camera: GameCamera | null = null) {
        this.scene = scene;
        this.camera = camera;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        // Or revert to default:
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        document.body.appendChild(this.renderer.domElement);

        // Setup post-processing for bloom
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene.scene, this.camera?.camera || new THREE.Camera());
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.2,    // strength (increased from 1.5)
            1.0,    // radius (increased from 0.8)
            0.2  // threshold (decreased from 0.45 - lower = more colors glow)
        );
        this.composer.addPass(bloomPass);

        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.uniforms['resolution'].value.x = 1 / window.innerWidth;
        fxaaPass.uniforms['resolution'].value.y = 1 / window.innerHeight;
        this.composer.addPass(fxaaPass);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    public setCamera(camera: GameCamera) {
        this.camera = camera;
        if (this.composer) {
            const renderPass = this.composer.passes[0] as RenderPass;
            renderPass.camera = camera.camera;
        }
    }

    public onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
        this.composer?.setSize(width, height);
        this.camera?.onWindowResize();
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
}
