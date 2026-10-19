import { Vector3, Quaternion } from 'three';
import type {
    IIntroStartedPayload,
    IStageCancelledPayload,
    ILevelDescriptor,
    ILevelProgress,
    IWaveClearedPayload,
    ILevelCompletedPayload,
} from '../config/interfaces/interfaces';
import { GameEvents, CollisionLayer } from '../config/types/types';
import type { InvaderTypeId, ExplosionKind, CollisionLayerFlag } from '../config/types/types';
import { INSTANCED_ASSETS, INVADER_ASSET_KEYS, INVADER_WEAPONS, INVADER_WEAPON_TYPES, LEVEL, PLAYER, WEAPONS, COLLISION, DEBUG, GAME_OVER } from '../config/data/constants';
import type { IGameContext } from '../config/interfaces/interfaces';
import { EntityManager } from '../entities/EntityManager';
import { Invader } from '../entities/Invader';
import { InvaderWeapon } from '../entities/InvaderWeapon';
import { MineWeapon } from '../entities/MineWeapon';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Weapon } from '../entities/Weapon';
import { ProjectilePool } from './ProjectilePool';
import { InvaderWeaponPool } from './InvaderWeaponPool';
import { CollisionSystem } from './collision/CollisionSystem';
import { DebrisSystem } from './fx/DebrisSystem';
import { SparkSystem } from './fx/SparkSystem';
import { EntryPatternDirector } from './patterns/directors/EntryPatternDirector';
import { FormationController } from './FormationController';
import type { IPatternDirector, IPlaySessionStartOptions, ICollisionHit, ICollisionMover, ICollisionTarget, IWeaponLaunch } from '../config/interfaces/interfaces';
import { Stage } from './stages/Stage';
import { StageQueue } from './stages/StageQueue';
import { Level } from './stages/Level';
import { SimpleLoopFormationPatternBuilder } from './patterns/patterns/formation-patterns/SimpleLoopFormationPatternBuilder';

const identityOrientation = new Quaternion();



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
    private weaponPool: InvaderWeaponPool | null = null;

    private collision: CollisionSystem | null = null;
    // Reused every frame so collision runs without allocating.
    private readonly collisionMovers: ICollisionMover[] = [];
    private readonly collisionTargets: ICollisionTarget[] = [];

    private debris: DebrisSystem | null = null;
    private sparks: SparkSystem | null = null;
    private readonly sparkOrigin = new Vector3();
    private readonly debrisVelocity = new Vector3();
    /** Reused by the invaders' weapon triggers to describe the weapon being released. */
    private readonly weaponLaunch: IWeaponLaunch = {
        origin: new Vector3(),
        velocity: new Vector3(),
        orientation: new Quaternion(),
    };
    private frameDt = 0;
    /** Seconds until a destroyed player respawns (the length of their explosion). */
    private respawnCountdown = 0;
    /** True when the destroyed player had no lives left: the game ends once the explosion has finished. */
    private gameOverPending = false;

    /** True once the current wave's entry stage has finished spawning, so an empty field means the wave is cleared. */
    private entryFinished = false;
    /** Seconds left in the "next wave" pause after a wave is cleared (0 when not paused). */
    private waveClearRemaining = 0;

    private ctx: IGameContext | null = null;
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

        for (const { key, maxCount } of INSTANCED_ASSETS) {
            ctx.assets.getOrCreateInstancedMesh(key, maxCount);
        }
        this.weaponPool = new InvaderWeaponPool(ctx.assets);

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
        this.startNextWave('skipped');
    }

    /** True while the "next wave" pause is showing after every invader of a wave has been destroyed. */
    public get isBetweenWaves(): boolean {
        return this.waveClearRemaining > 0;
    }

    private startNextWave(reason: IWaveClearedPayload['reason']): void {
        const ctx = this.ctx;
        const level = this.level;
        const levels = this.levels;
        if (!this.started || !ctx || !level || !levels) return;

        const leaving = this.getProgress()!;
        ctx.events.emit(GameEvents.waveCleared, { ...leaving, reason } satisfies IWaveClearedPayload);

        // A skip cancels a running stage; a finished wave has nothing left to cancel, so stay quiet.
        this.clearActiveInvaders('manual', reason === 'skipped');

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
        this.weaponPool?.clear();
        this.ctx?.playField.clearInvaders();
    }

    public update(dt: number): void {
        if (!this.started) return;

        const betweenWaves = this.isBetweenWaves;
        if (!betweenWaves) {
            this.formation.update(dt);
            this.director?.update(dt);
        }

        // Player first: invaders.update() flags all instanced meshes dirty once, at the end.
        this.respawnCountdown = Math.max(0, this.respawnCountdown - dt);
        this.updatePlayer(dt);
        this.projectilePool?.update(dt);
        this.weaponPool?.update(dt);
        this.invaders?.update(dt);
        this.frameDt = dt;
        this.updateInvaderWeapons(dt);
        this.debris?.update(dt);
        this.sparks?.update(dt);
        this.updateCollisions();

        if (betweenWaves) {
            this.waveClearRemaining -= dt;
            if (this.waveClearRemaining <= 0) this.startNextWave('finished');
            return;
        }

        if (this.director?.isComplete() && !this.gameOver) {
            this.advanceStage();
        }
        this.checkWaveCleared();
    }

    /** Once every invader of the wave has been spawned and destroyed, pause briefly and then go to the next wave. */
    private checkWaveCleared(): void {
        if (!this.level || !this.entryFinished || this.gameOverPending || this.gameOver) return;
        if (!this.invaders || this.invaders.count > 0) return;

        if (LEVEL.waveClearDelaySec > 0) {
            this.waveClearRemaining = LEVEL.waveClearDelaySec;
        } else {
            this.startNextWave('finished');
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
        this.weaponPool?.clear();
        this.weaponPool = null;
        this.collision = null;
        this.collisionMovers.length = 0;
        this.collisionTargets.length = 0;
        this.debris?.dispose();
        this.debris = null;
        this.sparks?.dispose();
        this.sparks = null;
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
            ctx.assets.getVoxelCloud(key);
        }
        for (const type of INVADER_WEAPON_TYPES) {
            const invaderWeapon = INVADER_WEAPONS[type];
            // The player is swept by the weapon.
            this.player.collisionModels.get(invaderWeapon.collisionRadius);
            // Only mines are swept by player shots and break into debris.
            if (invaderWeapon.kind !== 'mine') continue;
            ctx.assets.getCollisionModels(invaderWeapon.assetKey).get(weaponConfig.collisionRadius);
            ctx.assets.getVoxelCloud(invaderWeapon.assetKey);
        }
        ctx.assets.getVoxelCloud(PLAYER.assetKey);

        this.debris = new DebrisSystem(ctx.playField);
        ctx.scene.scene.add(this.debris.mesh);
        this.sparks = new SparkSystem();
        ctx.scene.scene.add(this.sparks.mesh);
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
        // Only mines can be hit; lazers are movers only.
        const weapons = this.weaponPool?.liveWeapons;
        if (weapons) {
            for (const weapon of weapons) {
                if (!weapon.collisionEnabled) continue;
                // Non-shootable mines are filtered out of the target list by the collision rules.
                if (weapon instanceof MineWeapon) targets.push(weapon);
                if (this.player?.collisionEnabled) movers.push(weapon);
            }
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
     * Collision response. A shot is spent and destroys the invader it hits. An invader that rams the player is
     * destroyed and, unless the player is invincible, costs a life. Destroyed ships break apart into debris.
     */
    private resolveHit(hit: ICollisionHit): void {
        const { mover, target } = hit;

        if (target instanceof Invader) {
            if (!target.collisionEnabled) return;
            if (mover instanceof Projectile) this.projectilePool?.release(mover);
            this.destroyInvader(target);
        } else if (target instanceof MineWeapon) {
            if (!target.collisionEnabled) return;
            if (mover instanceof Projectile) {
                this.projectilePool?.release(mover);
                // Weapons survive hits until their hit points run out; a surviving one is knocked back and throws sparks.
                if (!target.takeHit(mover.power)) {
                    this.emitSparks(hit.x, target.position.y, hit.z, target.velocity);
                    return;
                }
            }
            this.destroyInvaderWeapon(target);
        } else if (target instanceof Player && target === this.player && target.collisionEnabled) {
            if (mover instanceof Invader && mover.collisionEnabled) this.destroyInvader(mover);
            if (mover instanceof InvaderWeapon && mover.collisionEnabled) this.destroyInvaderWeapon(mover);
            this.onPlayerHit(target);
        }
    }

    private destroyInvader(invader: Invader): void {
        this.explodeInvader(invader);
        this.invaders?.remove(invader);
    }

    /** Sparks fly up and back (away from the player) out of the hit. */
    private emitSparks(x: number, y: number, z: number, targetVelocity: Vector3): void {
        this.sparkOrigin.set(x, y, z);
        this.sparks?.emit(this.sparkOrigin, targetVelocity);
    }

    private destroyInvaderWeapon(weapon: InvaderWeapon): void {
        // Only mines break apart; a lazer that hits the player just disappears.
        if (weapon instanceof MineWeapon) {
            this.debrisVelocity.copy(weapon.velocity);
            this.explode('invader', INVADER_WEAPONS[weapon.type].assetKey, weapon.position, identityOrientation, this.debrisVelocity);
        }
        this.weaponPool?.release(weapon);
    }

    /**
     * Asks every diving invader's weapon triggers whether to release a weapon this frame and spawns the ones
     * that do. Lazers that aim at the player need the player's position (null while the player is out of play).
     */
    private updateInvaderWeapons(dt: number): void {
        const pool = this.weaponPool;
        const invaders = this.invaders;
        if (!pool || !invaders || dt <= 0) return;

        const playerPresent = this.player !== null;
        const target = this.player?.collisionEnabled ? this.player.position : null;
        const launch = this.weaponLaunch;
        const overrides = this.currentStage?.weaponOverrides;

        for (const entity of invaders.getAll()) {
            if (!(entity instanceof Invader)) continue;
            for (const type of INVADER_WEAPON_TYPES) {
                if (!entity.pollWeaponRelease(type, dt, target, launch, playerPresent, overrides?.[type])) continue;
                const layer = INVADER_WEAPONS[type].kind === 'mine' ? this.invaderWeaponLayer() : CollisionLayer.INVADER_WEAPON;
                if (pool.spawn(type, launch.origin, launch.velocity, launch.orientation, layer)) {
                    entity.commitWeaponRelease(type);
                }
            }
        }
    }

    /** Mines can be shot only when the player's current weapon destroys them; lazers can never be shot. */
    private invaderWeaponLayer(): CollisionLayerFlag {
        return WEAPONS[PLAYER.weapon].destroysMines
            ? CollisionLayer.INVADER_WEAPON_SHOOTABLE
            : CollisionLayer.INVADER_WEAPON;
    }

    /** Loses a life. The ship stays out of play until its explosion has finished, then respawns or the game ends. */
    private onPlayerHit(player: Player): void {
        const ctx = this.ctx;
        if (DEBUG.invinciblePlayer || !ctx) return;

        const explosionSec = this.explodePlayer(player);
        ctx.events.emit(GameEvents.playerDied, undefined);
        player.down();
        this.respawnCountdown = explosionSec;
        this.gameOverPending = ctx.game.loseLife();
    }

    private explodeInvader(invader: Invader): void {
        const dt = this.frameDt;
        const inverse = dt > 0 ? 1 / dt : 0;
        // The invader follows paths rather than integrating velocity, so measure it from this frame's movement.
        this.debrisVelocity.set(
            (invader.position.x - invader.previousPosition.x) * inverse,
            (invader.position.y - invader.previousPosition.y) * inverse,
            (invader.position.z - invader.previousPosition.z) * inverse,
        );
        this.explode('invader', invader.assetKey, invader.position, invader.orientation, this.debrisVelocity);
    }

    /** Returns how long (s) the player's explosion takes to finish. */
    private explodePlayer(player: Player): number {
        return this.explode('player', PLAYER.assetKey, player.position, player.orientation, player.velocity);
    }

    /** Spawns the debris for a destroyed ship and returns the longest particle lifetime (0 if there is no debris system). */
    private explode(
        kind: ExplosionKind,
        assetKey: string,
        position: Vector3,
        orientation: Quaternion,
        velocity: Vector3,
    ): number {
        const ctx = this.ctx;
        if (!this.debris || !ctx) return 0;
        return this.debris.explode(kind, ctx.assets.getVoxelCloud(assetKey), position, orientation, velocity);
    }

    /** Shots already in flight keep travelling; they are only cleared on dispose. */
    private removePlayer(): void {
        this.player?.dispose();
        this.player = null;
        this.playerWeapon = null;
    }

    /**
     * Ends play: the ship is removed and no more invaders spawn, but everything already on the field (invaders,
     * their weapons, the player's explosion) keeps updating until the session is disposed.
     */
    private beginGameOver(): void {
        this.removePlayer();
        this.director?.cancel();
        this.gameOver = true;
    }

    /** Seconds left in the destroyed player's explosion (0 when there is none). */
    public get playerExplosionSecondsLeft(): number {
        return this.respawnCountdown;
    }

    /** True while any debris (explosions) is still flying. */
    public get hasActiveDebris(): boolean {
        return (this.debris?.activeCount ?? 0) > 0;
    }

    /** Invaders still on the field. */
    public get invaderCount(): number {
        return this.invaders?.count ?? 0;
    }

    /** Blows up one random invader (as if shot, but with no score). Returns false when there are none left. */
    public explodeRandomInvader(): boolean {
        const entities = this.invaders?.getAll();
        if (!entities || entities.length === 0) return false;

        const start = Math.floor(Math.random() * entities.length);
        for (let n = 0; n < entities.length; n++) {
            const entity = entities[(start + n) % entities.length];
            if (entity instanceof Invader) {
                this.destroyInvader(entity);
                return true;
            }
        }
        return false;
    }

    private updatePlayer(dt: number): void {
        const player = this.player;
        const input = this.ctx?.input;
        if (!player || !input) return;

        const anyDown = (keys: readonly string[]): number => (keys.some((k) => input.isDown(k)) ? 1 : 0);

        // A destroyed ship stays out of play until its explosion has finished. The countdown runs on its own
        // so the explosion's remaining time can still be read after the ship is removed.
        if (player.isDown) {
            if (this.gameOverPending) {
                // The game over screen takes over GAME_OVER.overlapSeconds before the explosion ends.
                if (this.respawnCountdown <= GAME_OVER.overlapSeconds) this.beginGameOver();
                return;
            }
            if (this.respawnCountdown > 0) return;
            // Respawns flashing and protected.
            player.respawn();
        }

        const axisX = anyDown(PLAYER.keys.right) - anyDown(PLAYER.keys.left);
        const axisZ = anyDown(PLAYER.keys.forward) - anyDown(PLAYER.keys.back);
        player.setInput(axisX, axisZ);
        player.update(dt);

        this.playerWeapon?.update(dt);
        if (anyDown(PLAYER.keys.fire) && player.canFire) {
            this.playerWeapon?.tryFire(player.position);
        }
    }

    private onlyEntryStage(): boolean {
        return this.stageQueue?.stages.length === 1 && this.stageQueue?.stages[0].name === 'Entry';
    }

    private advanceStage(): void {
        if (!this.stageQueue || !this.ctx) return;
        // The entry stage is the only one that spawns invaders, so once it completes the whole wave is on the field.
        this.entryFinished = true;
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
    private clearActiveInvaders(reason: IStageCancelledPayload['reason'], announce = true): void {
        const ctx = this.ctx;
        if (!ctx) return;

        if (this.director?.isRunning()) {
            this.director.cancel();

            if (announce) {
                ctx.events.emit(GameEvents.stageCancelled, { reason } satisfies IStageCancelledPayload);
            }
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
        this.weaponPool?.clear();
        this.beginCurrentWave(reason);
    }

    /** Set up the formation for the current stageQueue and begin the current stage's director. */
    private beginCurrentWave(reason: IIntroStartedPayload['reason']): void {
        const ctx = this.ctx;
        if (!ctx) return;

        this.entryFinished = false;
        this.waveClearRemaining = 0;

        const formationDescription = this.stageQueue?.getFormationDescription();
        if (!formationDescription) {
            throw new Error("StageQueue has no formation descriptor");
        }

        const patternBuilder = new SimpleLoopFormationPatternBuilder();
        const pattern = patternBuilder.build();
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
