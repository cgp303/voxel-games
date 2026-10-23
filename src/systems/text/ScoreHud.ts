import * as THREE from 'three';
import type { Game } from '../../app/Game';
import type { IHudConfig, IHudTextLook, IVoxelTextStyle } from '../../config/interfaces/interfaces';
import { placeTextInFrontOfCamera, type ITextPlacement } from './placeText';
import { formatScore } from './formatScore';
import type { VoxelFont } from './VoxelFont';
import { VoxelReadout } from './VoxelReadout';
import { VoxelText } from './VoxelText';

/**
 * The player's score and lives, drawn in voxel text high and far in front of the camera: SCORE on the left and
 * LIVES on the right, each followed by its value. It belongs to the app rather than a screen, so it carries on
 * through Demo, Play and Game Over; the values simply follow `game.score` and `game.lives` (Play resets them).
 * Call update() every frame: it keeps the HUD at its place relative to the camera and rewrites a value only when it changes.
 */
export class ScoreHud {
    private readonly root = new THREE.Group();
    private readonly placement: ITextPlacement;
    private readonly camera: THREE.Camera;
    private readonly game: Game;
    private readonly config: IHudConfig;
    private readonly labels: VoxelText[] = [];
    private readonly scoreReadout: VoxelReadout;
    private readonly livesReadout: VoxelReadout;
    private shownScore = '';
    private shownLives = '';

    constructor(font: VoxelFont, scene: THREE.Scene, camera: THREE.Camera, game: Game, config: IHudConfig) {
        this.camera = camera;
        this.game = game;
        this.config = config;
        this.placement = { cameraDistance: config.cameraDistance, offsetX: 0, offsetY: config.offsetY, pitch: config.pitch };
        this.root.name = 'ScoreHud';

        const labelStyle = this.styleOf(config.labels);
        const valueStyle = this.styleOf(config.values);
        const labelGap = config.labelGap * config.scale;

        const addLabel = (text: string, x: number): number => {
            const label = new VoxelText(font, labelStyle);
            label.setText(text);
            // Text is centred on its origin, so shift by half its width to put its left edge at x.
            const width = VoxelText.measure(font, text, labelStyle.letterGap) * config.scale;
            label.group.position.x = x + width / 2;
            this.root.add(label.group);
            this.labels.push(label);
            return x + width + labelGap;
        };

        const scoreValueX = addLabel(config.score.label, config.score.labelX);
        this.scoreReadout = new VoxelReadout(font, valueStyle);
        this.scoreReadout.group.position.x = scoreValueX;
        this.root.add(this.scoreReadout.group);

        const livesValueX = addLabel(config.lives.label, config.lives.labelX);
        this.livesReadout = new VoxelReadout(font, valueStyle);
        this.livesReadout.group.position.x = livesValueX;
        this.root.add(this.livesReadout.group);

        scene.add(this.root);
        this.update();
    }

    public update(): void {
        placeTextInFrontOfCamera({ group: this.root }, this.camera, this.placement);

        const score = formatScore(this.game.score, this.config.score.digits);
        if (score !== this.shownScore) {
            this.shownScore = score;
            this.scoreReadout.setValue(score);
        }
        const lives = String(Math.max(0, Math.floor(this.game.lives)));
        if (lives !== this.shownLives) {
            this.shownLives = lives;
            this.livesReadout.setValue(lives);
        }
    }

    public dispose(): void {
        for (const label of this.labels) label.dispose();
        this.labels.length = 0;
        this.scoreReadout.dispose();
        this.livesReadout.dispose();
        this.root.removeFromParent();
    }

    private styleOf(look: IHudTextLook): IVoxelTextStyle {
        return { ...look, scale: this.config.scale, castShadow: this.config.castShadow };
    }
}
