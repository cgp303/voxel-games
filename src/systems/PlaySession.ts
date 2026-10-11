import { Vector3 } from 'three';
import type {
    IFormationConfig,
    IIntroStartedPayload,
    IStageCancelledPayload,
    ILevelDescriptor,
    ILevelProgress,
    IWaveClearedPayload,
    ILevelCompletedPayload,
} from '../config/interfaces/interfaces';
import { GameEvents } from '../config/types/types';
import type { InvaderTypeId } from '../config/types/types';
import { INSTANCED_ASSETS, INVADER_ASSET_KEYS, LEVEL, PLAYER, WEAPONS, COLLISION, DEBUG } from '../config/data/constants';
import type { IGameContext } from '../config/interfaces/interfaces';
import { EntityManager } from '../entities/EntityManager';
import { Invader } from '../entities/Invader';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Weapon } from '../entities/Weapon';
import { ProjectilePool } from './ProjectilePool';
import { CollisionSystem } from './collision/CollisionSystem';
import type { ICollisionHit, ICollisionMover, ICollisionTarget } from './collision/collisionTypes';
import { EntryPatternDirector } from './patterns/directors/EntryPatternDirector';
import { FormationController } from './FormationController';
import type { IPatternDirector, IPlaySessionStartOptions } from '../config/interfaces/interfaces';
import { Stage } from './stages/Stage';
import { StageQueue } from './stages/StageQueue';
import { Level } from './stages/Level';
import { SimpleLoopFormationPatternBuilder } from './patterns/patterns/formation-patterns/SimpleLoopFormationPatternBuilder';



/**
 * Owns one intro/combat simulation slice: formation + entry director + entities.
 * Screens call start / update / restartIntro / dispose; they do not own the sub-pieces.
 *
 * Frame order:
 *   1. formation.update  — live homes move first
 *   2. entry.update      — may spawn pairs
 *   3. entities.update   — path follow / dock to live homes
 *
 * Edge-case hooks (Phase 9):
 * - cancelEntry / onPlayerDeath — stop new spawns (queue cleared; in-flight keep going)
 * - restartIntro — full clear + new entry (in-mode retry)
 * - dispose — cancel + clear everything (screen exit)
 * - Demo/Play screen enter creates a fresh session (Esc→Demo restarts intro that way)
 */
export class PlaySession {
    public invaders: EntityManager | null = null;
    public player: Player | null = null;
    public readonly formation = new FormationController();
    /** Set when the player loses their last life; the owning screen switches to game over. */
    public gameOver = false;

    private projectilePool: ProjectilePool | null = null;
    private playerWeapon: Weapon | null = null;

    private collision: CollisionSystem | null = null;
    // Reused every frame so collision runs without allocating.
    private readonly collisionMovers: ICollisionMover[] = [];
    private readonly collisionTargets: ICollisionTarget[] = [];

    private ctx: IGameContext | null = null;
    private formationOverride: Partial<IFormationConfig> = {};
    private started = false;

    private stageQueue: StageQueue | null = null;
    private currentStage: Stage | null = null;
    private director: IPatternDirector | null = null;

    // Level sequence (null in single-wave mode, e.g. Demo).
    private levels: ILevelDescriptor[] | null = null;
    private levelIndex = 0;
    private level: Level | null = null;

    private readonly getInvaderTypeForSlot = (col: number, row: number): InvaderTypeId =>
        this.stageQueue?.getTypeForSlot(col, row) ?? 'scout';

    /**
     * Clear field, setup formation from terrain height, begin first stage
     */
    public start(ctx: IGameContext, options: IPlaySessionStartOptions = {}): void {
        this.ctx = ctx;

        this.invaders = new EntityManager(ctx.assets);

        this.formationOverride = options.formation ?? {};

        for (const { key, maxCount } of INSTANCED_ASSETS) {
            ctx.assets.getOrCreateInstancedMesh(key, maxCount);
        }

        if (options.spawnPlayer) {
            this.spawnPlayer(ctx);
        }
        if (options.levels && options.levels.length > 0) {
            this.levels = options.levels;
            this.levelIndex = 0;
            this.level = new Level(this.levels[0]);
            this.stageQueue = this.level.nextWave();
        } else {
            this.stageQueue = options.stageQueue ?? null;
        }

        if (this.stageQueue) {
            this.currentStage = this.stageQueue.next();
            this.director = this.currentStage.director;
        } else {
            // Fallback mode: demo screen or legacy behavior
            this.director = new EntryPatternDirector();
        }

        this.bootIntro('start');
        this.started = true;

        if (this.level) {
            this.ctx.events.emit(GameEvents.levelStarted, this.getProgress()!);
            this.ctx.events.emit(GameEvents.waveStarted, this.getProgress()!);
        }
    }

    /** Current level / wave position, or null when not running a level sequence. Pass `out` to avoid allocating. */
    public getProgress(out: ILevelProgress = { levelIndex: 0, levelName: '', waveIndex: 0, waveCount: 0 }): ILevelProgress | null {
        if (!this.level) return null;
        out.levelIndex = this.levelIndex;
        out.levelName = this.level.name;
        out.waveIndex = this.level.currentWaveIndex;
        out.waveCount = this.level.waveCount;
        return out;
    }

    /**
     * Dispose every active invader and start the next wave of the level.
     * After the last wave the next level begins; after the last level the
     * sequence loops back to LEVEL.loopFromIndex. No-op outside a level sequence.
     */
    public advanceWave(): void {
        const ctx = this.ctx;
        const level = this.level;
        const levels = this.levels;
        if (!this.started || !ctx || !level || !levels) return;

        const leaving = this.getProgress()!;
        ctx.events.emit(GameEvents.waveCleared, { ...leaving, reason: 'skipped' } satisfies IWaveClearedPayload);

        this.clearActiveInvaders('manual');

        let nextQueue = level.nextWave();
        let startedNewLevel = false;
        if (!nextQueue) {
            ctx.events.emit(GameEvents.levelCompleted, {
                levelIndex: this.levelIndex,
                levelName: level.name,
            } satisfies ILevelCompletedPayload);

            this.levelIndex = this.levelIndex + 1 >= levels.length ? LEVEL.loopFromIndex : this.levelIndex + 1;
            this.level = new Level(levels[this.levelIndex]);
            nextQueue = this.level.nextWave()!;
            startedNewLevel = true;
        }

        this.stageQueue = nextQueue;
        this.currentStage = nextQueue.next();
        this.director = this.currentStage.director;
        this.beginCurrentWave('start');

        if (startedNewLevel) {
            ctx.events.emit(GameEvents.levelStarted, this.getProgress()!);
        }
        ctx.events.emit(GameEvents.waveStarted, this.getProgress()!);
    }

    /**
     * Tear down actors and run the off-stage → formation intro again
     * on the same session instance (in-mode retry).
     * Demo/Play transitions typically dispose + new PlaySession instead.
     */
    public restartIntro(): void {
        if (!this.ctx) {
            throw new Error('PlaySession.restartIntro: call start(ctx) first');
        }
        this.bootIntro('restart');
    }

    // /**
    //  * Stop scheduling new entry spawns. In-flight invaders keep flying/docking
    //  * unless the caller also clearCombatants() or dispose().
    //  */
    // public cancelEntry(reason: EntryCancelledPayload['reason'] = 'manual'): void {
    //     if (!this.started) return;
    //     if (this.entryDirector?.isCancelled() && this.entryDirector.queueRemaining === 0) return;

    //     this.entryDirector?.cancel();
    //     this.ctx?.events.emit(GameEvents.entryCancelled, {
    //         reason,
    //     } satisfies EntryCancelledPayload);
    // }

    /**
     * Player death policy: cancel the entry queue (decision #2).
     * Does not wipe already-spawned invaders — call clearCombatants() if needed.
     * Emits player:died for future lives / UI listeners.
     */
    public onPlayerDeath(): void {
        if (!this.started || !this.ctx) return;

        this.removePlayer();

        // Cancel current director/stage
        if (this.director && !this.director.isCancelled()) {
            this.director.cancel();

            this.ctx.events.emit(GameEvents.stageCancelled, {
                reason: 'player_death',
            } satisfies IStageCancelledPayload);
        }

        this.ctx.events.emit(GameEvents.playerDied, undefined);
    }


    /**
     * Remove all session invaders and playfield invader meshes without
     * restarting entry (board wipe after death, etc.).
     */
    public clearCombatants(): void {
        this.invaders?.clear();
        this.ctx?.playField.clearInvaders();
    }

    public update(dt: number): void {
        if (!this.started) return;

        this.formation.update(dt);
        this.director?.update(dt);

        // Player first: invaders.update() flags all instanced meshes dirty once, at the end.
        this.updatePlayer(dt);
        this.projectilePool?.update(dt);
        this.invaders?.update(dt);
        this.updateCollisions();

        if (this.director?.isComplete()) {
            this.advanceStage();
        }

    }

    public isStarted(): boolean {
        return this.started;
    }

    public isStageCancelled(): boolean {
        return this.director?.isCancelled() ?? false;
    }

    public isStageComplete(): boolean {
        return this.director?.isComplete() ?? false;
    }


    public dispose(): void {
        if (this.started) {
            const hadPending =
                this.director?.isRunning() &&
                (this.director?.queueRemaining > 0 || !this.director?.isComplete());
            this.director?.cancel();
            if (hadPending) {
                this.ctx?.events.emit(GameEvents.stageCancelled, {
                    reason: 'dispose',
                } satisfies IStageCancelledPayload);
            }
        }

        this.removePlayer();
        this.projectilePool?.clear();
        this.projectilePool = null;
        this.collision = null;
        this.collisionMovers.length = 0;
        this.collisionTargets.length = 0;
        this.invaders?.clear();
        this.ctx?.playField.clearInvaders();
        this.ctx = null;
        this.started = false;
    }

    private spawnPlayer(ctx: IGameContext): void {
        const mesh = ctx.assets.getOrCreateInstancedMesh(PLAYER.assetKey);
        this.player = new Player(mesh, {
            minX: PLAYER.minX,
            maxX: PLAYER.maxX,
            minZ: PLAYER.spawnZ - PLAYER.zRange,
            maxZ: PLAYER.spawnZ + PLAYER.zRange,
            y: ctx.playField.bounds.height + PLAYER.hoverPadding,
        });

        const weaponConfig = WEAPONS[PLAYER.weapon];
        const shotMesh = ctx.assets.getOrCreateInstancedMesh(weaponConfig.assetKey, weaponConfig.maxCount);
        this.projectilePool = new ProjectilePool(shotMesh, weaponConfig);
        this.playerWeapon = new Weapon(this.projectilePool, weaponConfig);

        this.collision = new CollisionSystem(COLLISION);
        this.player.collisionModels = ctx.assets.getCollisionModels(PLAYER.assetKey);
        // Bake every footprint for the mover radii now so the first shot or collision does not hitch.
        this.player.collisionModels.get(COLLISION.invaderRadius);
        for (const key of INVADER_ASSET_KEYS) {
            ctx.assets.getCollisionModels(key).get(weaponConfig.collisionRadius);
        }
    }

    /**
     * Sweeps every live shot against the invaders, and the invaders against the player, then applies the hits.
     * Runs after all movement so everything is at this frame's positions.
     */
    private updateCollisions(): void {
        const collision = this.collision;
        const pool = this.projectilePool;
        const invaders = this.invaders;
        if (!collision || !pool || !invaders) return;

        const movers = this.collisionMovers;
        const targets = this.collisionTargets;
        for (const shot of pool.liveShots) {
            if (shot.collisionEnabled) movers.push(shot);
        }
        for (const entity of invaders.getAll()) {
            if (!(entity instanceof Invader)) continue;
            targets.push(entity);
            if (this.player?.collisionEnabled) movers.push(entity);
        }
        if (this.player) targets.push(this.player);

        if (movers.length > 0) {
            for (const hit of collision.update(movers, targets)) {
                this.resolveHit(hit);
            }
        }
        movers.length = 0;
        targets.length = 0;
    }

    /**
     * Collision response. A shot is spent and removes the invader it hits. An invader that rams the player is
     * destroyed and, unless the player is invincible, costs a life.
     */
    private resolveHit(hit: ICollisionHit): void {
        const { mover, target } = hit;

        if (target instanceof Invader) {
            if (!target.collisionEnabled) return;
            if (mover instanceof Projectile) this.projectilePool?.release(mover);
            this.invaders?.remove(target);
        } else if (target instanceof Player && target === this.player && target.collisionEnabled) {
            if (mover instanceof Invader && mover.collisionEnabled) this.invaders?.remove(mover);
            this.onPlayerHit(target);
        }
    }

    /** Loses a life, then either respawns the ship (flashing, protected) or ends the game. */
    private onPlayerHit(player: Player): void {
        const ctx = this.ctx;
        if (DEBUG.invinciblePlayer || !ctx) return;

        ctx.events.emit(GameEvents.playerDied, undefined);
        if (ctx.game.loseLife()) {
            this.removePlayer();
            this.gameOver = true;
        } else {
            player.respawn();
        }
    }

    /** Shots already in flight keep travelling; they are only cleared on dispose. */
    private removePlayer(): void {
        this.player?.dispose();
        this.player = null;
        this.playerWeapon = null;
    }

    private updatePlayer(dt: number): void {
        const player = this.player;
        const input = this.ctx?.input;
        if (!player || !input) return;

        const anyDown = (keys: readonly string[]): number => (keys.some((k) => input.isDown(k)) ? 1 : 0);
        const axisX = anyDown(PLAYER.keys.right) - anyDown(PLAYER.keys.left);
        const axisZ = anyDown(PLAYER.keys.forward) - anyDown(PLAYER.keys.back);
        player.setInput(axisX, axisZ);
        player.update(dt);

        this.playerWeapon?.update(dt);
        if (anyDown(PLAYER.keys.fire) && !player.isRespawning) {
            this.playerWeapon?.tryFire(player.position);
        }
    }

    private onlyEntryStage(): boolean {
        return this.stageQueue?.stages.length === 1 && this.stageQueue?.stages[0].name === 'Entry';
    }

    private advanceStage(): void {
        if (!this.stageQueue || !this.ctx) return;
        if (this.onlyEntryStage()) {
            return;
        }

        this.currentStage = this.stageQueue.next();
        this.director = this.currentStage.director;

        this.director?.begin({
            formation: this.formation,
            invaders: this.invaders,
            playField: this.ctx.playField,
            config: this.currentStage.directorConfig,
            scene: this.ctx.scene.scene,
            getInvaderTypeForSlot: this.getInvaderTypeForSlot,
        });
    }

    /** Stop the running director and remove every invader (meshes, entities, instance slots). */
    private clearActiveInvaders(reason: IStageCancelledPayload['reason']): void {
        const ctx = this.ctx;
        if (!ctx) return;

        if (this.director?.isRunning()) {
            this.director.cancel();

            ctx.events.emit(GameEvents.stageCancelled, { reason } satisfies IStageCancelledPayload);
        } else {
            this.director?.cancel();
        }

        this.invaders?.clear();
        ctx.playField.clearInvaders();

        // Reset the InstancedMesh count and free-slots for every invader mesh (not the player's)
        for (const key of INVADER_ASSET_KEYS) {
            ctx.assets.resetInstancedMeshCount(key);
        }
    }

    private bootIntro(reason: IIntroStartedPayload['reason']): void {
        // Full reset: stop any prior queue, drop actors, rebuild formation + queue.
        this.clearActiveInvaders('restart');
        this.beginCurrentWave(reason);
    }

    /** Set up the formation for the current stageQueue and begin the current stage's director. */
    private beginCurrentWave(reason: IIntroStartedPayload['reason']): void {
        const ctx = this.ctx;
        if (!ctx) return;

        const formationDescription = this.stageQueue?.getFormationDescription();
        if (!formationDescription) {
            throw new Error("StageQueue has no formation descriptor");
        }

        const patternBuilder = new SimpleLoopFormationPatternBuilder();
        const pattern = patternBuilder.build(new Vector3(0, 20, 0), 1);
        this.formation.setPattern(pattern);

        this.formation.setup(ctx.playField.bounds.height, formationDescription);


        this.director?.begin({
            formation: this.formation,
            invaders: this.invaders,
            playField: ctx.playField,
            config: this.currentStage?.directorConfig ?? {},
            getInvaderTypeForSlot: this.getInvaderTypeForSlot,
        });


        ctx.events.emit(GameEvents.introStarted, { reason } satisfies IIntroStartedPayload);
    }
}
