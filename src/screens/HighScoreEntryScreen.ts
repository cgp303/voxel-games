import * as THREE from 'three';
import type { IGameContext, IScreen, IVoxelTextStyle } from '../config/interfaces/interfaces';
import { HIGH_SCORE_ENTRY, TEXT } from '../config/data/constants';
import { TopTenScores } from '../config/data/TopTenScores';
import { VoxelText } from '../systems/text/VoxelText';
import { placeTextInFrontOfCamera } from '../systems/text/placeText';
import type { DemoScreen } from './DemoScreen';

interface ILetterKey {
    char: string;
    text: VoxelText;
    /** Invisible box around the letter that the mouse ray is tested against (the glyphs alone are too thin to hit reliably). */
    hitBox: THREE.Mesh;
}

/**
 * Shown between Game Over and Demo when the score earns a top-ten place. The player clicks letters of a voxel
 * alphabet to build a handle; once it is complete (no deleting, no retries) the score goes into the table and
 * the Demo starts, so its high-score display already shows the new entry.
 */
export class HighScoreEntryScreen implements IScreen {
    public readonly id = 'high_score_entry';

    private ctx: IGameContext | null = null;
    private demoScreen: DemoScreen | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private readonly root = new THREE.Group();
    private readonly texts: VoxelText[] = [];
    private keys: ILetterKey[] = [];
    private entryText: VoxelText | null = null;
    private readonly hitGeometries: THREE.BufferGeometry[] = [];
    private readonly hitMaterial = new THREE.MeshBasicMaterial({ visible: false });

    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private pointerInside = false;
    private clickPending = false;
    private hovered: ILetterKey | null = null;

    private handle = '';
    /** Seconds since the handle was completed, or -1 while it is still being entered. */
    private finishTimer = -1;

    public setTransitions(demo: DemoScreen): void {
        this.demoScreen = demo;
    }

    public enter(ctx: IGameContext): void {
        this.ctx = ctx;
        ctx.game.mode = 'high_score_entry';
        ctx.playField.attachTo(ctx.scene.scene);
        ctx.camera.controls.enabled = false;

        this.handle = '';
        this.finishTimer = -1;
        this.hovered = null;
        this.clickPending = false;
        this.pointerInside = false;

        this.build(ctx);

        this.canvas = ctx.renderer.getDOMElement();
        this.canvas.addEventListener('pointermove', this.onPointerMove);
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        this.canvas.addEventListener('pointerleave', this.onPointerLeave);
        console.log('[HighScoreEntryScreen] enter — score', ctx.game.score);
    }

    public exit(): void {
        if (this.canvas) {
            this.canvas.removeEventListener('pointermove', this.onPointerMove);
            this.canvas.removeEventListener('pointerdown', this.onPointerDown);
            this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
            this.canvas.style.cursor = '';
            this.canvas = null;
        }
        for (const text of this.texts) text.dispose();
        this.texts.length = 0;
        for (const geometry of this.hitGeometries) geometry.dispose();
        this.hitGeometries.length = 0;
        this.keys = [];
        this.entryText = null;
        this.hovered = null;
        this.root.removeFromParent();
        this.ctx = null;
        console.log('[HighScoreEntryScreen] exit');
    }

    public update(dt: number): void {
        const ctx = this.ctx;
        if (!ctx || !this.demoScreen) return;

        if (this.finishTimer >= 0) {
            this.finishTimer += dt;
            if (this.finishTimer >= HIGH_SCORE_ENTRY.finishPauseSeconds) {
                this.finishTimer = -1;
                void ctx.screens.set(this.demoScreen);
            }
            return;
        }

        this.setHovered(this.pointerInside ? this.pick(ctx.camera.camera) : null);

        if (this.clickPending) {
            this.clickPending = false;
            if (this.hovered) this.addChar(ctx, this.hovered.char);
        }
    }

    private build(ctx: IGameContext): void {
        const config = HIGH_SCORE_ENTRY;
        const style = (color: number): IVoxelTextStyle => ({
            color,
            scale: config.scale,
            brightness: config.brightness,
            glowIntensity: config.glowIntensity,
            castShadow: config.castShadow,
        });
        const { header, alphabet, entry } = config;
        const sectionCount = 3;
        const lineCount = header.lines.length + alphabet.rows.length + 1;
        const blockHeight = (lineCount - 1) * config.lineHeight + (sectionCount - 1) * config.sectionGap;

        // Lines stack down the root's local -Y (top line first), centred on its origin; positions are in voxels until scaled.
        let y = blockHeight / 2;
        const addText = (line: string, color: number, x: number, lineY: number): VoxelText => {
            const text = new VoxelText(ctx.font, style(color));
            text.setText(line);
            text.group.position.set(x * config.scale, lineY * config.scale, 0);
            this.root.add(text.group);
            this.texts.push(text);
            return text;
        };

        for (const line of header.lines) {
            addText(line, header.color, 0, y);
            y -= config.lineHeight;
        }
        y -= config.sectionGap;

        for (const row of alphabet.rows) {
            const chars = [...row];
            const left = -((chars.length - 1) / 2) * alphabet.columnPitch;
            chars.forEach((char, i) => {
                const text = addText(char, alphabet.color, left + i * alphabet.columnPitch, y);
                // The hit box is a child of the letter's group, so it is in voxel units and moves with it.
                const width = VoxelText.measure(ctx.font, char) + alphabet.hitPadding * 2;
                const geometry = new THREE.BoxGeometry(width, TEXT.cellHeight + alphabet.hitPadding * 2, alphabet.hitPadding * 2);
                this.hitGeometries.push(geometry);
                const hitBox = new THREE.Mesh(geometry, this.hitMaterial);
                hitBox.name = `HighScoreKey:${char}`;
                text.group.add(hitBox);
                this.keys.push({ char, text, hitBox });
            });
            y -= config.lineHeight;
        }
        y -= config.sectionGap;

        this.entryText = addText('', entry.color, 0, y);

        this.root.name = 'HighScoreEntry';
        placeTextInFrontOfCamera({ group: this.root }, ctx.camera.camera, config);
        ctx.scene.scene.add(this.root);
        this.root.updateMatrixWorld(true);
    }

    private pick(camera: THREE.Camera): ILetterKey | null {
        this.raycaster.setFromCamera(this.pointer, camera);
        const hit = this.raycaster.intersectObjects(this.keys.map((key) => key.hitBox), false)[0];
        return hit ? (this.keys.find((key) => key.hitBox === hit.object) ?? null) : null;
    }

    private setHovered(key: ILetterKey | null): void {
        if (key === this.hovered) return;
        this.hovered?.text.setColor(HIGH_SCORE_ENTRY.alphabet.color);
        key?.text.setColor(HIGH_SCORE_ENTRY.alphabet.hoverColor);
        this.hovered = key;
        if (this.canvas) this.canvas.style.cursor = key ? 'pointer' : '';
    }

    private addChar(ctx: IGameContext, char: string): void {
        if (this.handle.length >= HIGH_SCORE_ENTRY.entry.length) return;
        this.handle += char;
        this.entryText?.setText(this.handle);
        if (this.handle.length < HIGH_SCORE_ENTRY.entry.length) return;

        // Complete: lock input, record the score and hold the handle on screen briefly before the Demo.
        this.setHovered(null);
        const rank = TopTenScores.insertScore(ctx.game.score, this.handle);
        void TopTenScores.submitScore(ctx.game.score, this.handle);
        console.log(`[HighScoreEntryScreen] ${this.handle} entered at rank ${rank}`);
        this.finishTimer = 0;
    }

    private readonly onPointerMove = (e: PointerEvent): void => {
        const canvas = this.canvas;
        if (!canvas) return;
        // The canvas has a fixed buffer size and is scaled by CSS, so normalise against its on-screen rectangle.
        const rect = canvas.getBoundingClientRect();
        this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        this.pointerInside = true;
    };

    private readonly onPointerDown = (e: PointerEvent): void => {
        if (e.button !== 0) return;
        this.onPointerMove(e);
        this.clickPending = true;
    };

    private readonly onPointerLeave = (): void => {
        this.pointerInside = false;
    };
}
