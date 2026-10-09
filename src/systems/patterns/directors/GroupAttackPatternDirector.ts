// systems/patterns/directors/GroupAttackPatternDirector.ts

import { Vector3 } from 'three';
import { GroupAttackPattern1Builder } from '../patterns/invader-patterns/GroupAttackPattern1Builder';
import { GroupAttackPattern2Builder } from '../patterns/invader-patterns/GroupAttackPattern2Builder';
import type { IDirectorContext, IInvaderGroup } from '../../../config/interfaces/interfaces';
import type { GroupType } from '../../../config/types/types';
import { groupAttackSets as GroupAttackSets } from '../../../config/pattern-config/GroupAttackSets';
import { InvaderRepathDirector } from './InvaderRepathDirector';


const ATTACK_GROUP_TYPE = 0;
const ATTACK_GROUP_ITERATIONS = 1;
const ATTACK_GROUP_PATH = 2;

export class GroupAttackPatternDirector extends InvaderRepathDirector {

    private invaderGroups;
    private timeSinceLastTrigger = 0;
    private _isComplete = false;
    private triggerDelay = 4.2; // time between triggers

    private groupAttackSet: [string, number, number][];
    private currentGroupSetIndex = 0;
    private currentGroupAttackSet: [string, number, number] | undefined;
    private maxSetIterations: number = 0;
    private numGroups: number;
    private groupAttackType: string = "";
    private currentInvaderGroup: IInvaderGroup | undefined;
    private setIterations: number = 0;

    private centralPosition: Vector3 = new Vector3();

    constructor(groupAttackSet: [string, number, number][]) {
        super();

        // instructions from the stage-queue
        // about what kinds of group attack to perform
        // and in what order
        this.groupAttackSet = groupAttackSet;

        // store the number of groups for later reference
        this.numGroups = groupAttackSet.length;
    }

    public begin(ctx: IDirectorContext): void {
        this.captureCommon(ctx);

        const path = this.groupAttackSet[0][ATTACK_GROUP_PATH];
        this.builder = path == 0 ? new GroupAttackPattern1Builder() : new GroupAttackPattern2Builder();
        // reset set index
        this.currentGroupSetIndex = 0;

        this.setUpAGroupAttack();

        this.setIterations = 0;

        this._isComplete = false
        this.timeSinceLastTrigger = 0;
        this.triggerDelay = 0; // no trigger delay on begin unless we want to have a pause between attack patterns.
        this.completionCooldown = 0; // reset completion cooldown on begin
    }

    public update(dt: number): void {

        ////////////////////////////////////////////
        // First deal with timing:
        ////////////////////////////////////////////

        // return if not active
        if (!this.running || this.cancelled) return;

        // return if in completion cooldown
        if (this.tickCooldown(dt)) return;

        // // pause between invader triggers
        this.timeSinceLastTrigger += dt;
        if (this.timeSinceLastTrigger < this.triggerDelay) return;

        // reset time since last trigger
        this.timeSinceLastTrigger = 0;

        // Pick the group to launch: the current one if any of its invaders are still available,
        // otherwise the next shuffled group that has some. Missing/destroyed slots are simply left out.
        let group = this.currentInvaderGroup;
        let availableKeys = group ? this.getAvailableKeys(group.group) : [];
        while (availableKeys.length === 0) {
            group = this.invaderGroups.pop();
            if (!group) break;
            availableKeys = this.getAvailableKeys(group.group);
        }

        if (!group) {
            // No usable group left in this set: move straight on to the next set (or finish).
            this.currentInvaderGroup = undefined;
            this.triggerDelay = 0;
            this.endCurrentSet();
            return;
        }
        this.currentInvaderGroup = group;

        // release group of invaders
        const path = group.path;
        const side = path === "left" ? 0 : path === "right" ? 1 : Math.random() < 0.5 ? 0 : 1;


        // for group attacks in which absolute world positions are used rather
        // than relative positions, we need to calculate invader offsets from a 
        // central position, to maintain formation. And we need to set each invaders
        // offset relative to that central position.
        // if an attack offset is not set, the invaders offsets will be {0,0,0}
        this.setAttackOffsets(availableKeys);

        const duration = this.builder.duration();

        const predictedEndPosition = this.formation.getAdjustedPositionForGroupReturn(this.centralPosition, duration);

        const pattern = this.builder.build(this.centralPosition, side, predictedEndPosition);
        // update trigger delay for this pattern.
        this.triggerDelay = pattern.duration - pattern.durationOverlap;
        this.coolDownPeriod = pattern.duration;

        for (const invaderKey of availableKeys) {
            const invader = this.invaders?.getInvaderAtSlot(invaderKey);
            if (invader && invader.active) {
                this.applyPattern(invader, pattern, { attackOffset: invader.attackOffset });
            }
        }

        // prepare for the next set iteration
        this.setIterations++;
        if (this.setIterations >= this.maxSetIterations) {
            this.endCurrentSet();
        } else {
            this.currentInvaderGroup = this.invaderGroups.pop();
        }
    }

    /** Slot keys from a group that currently hold an active formation invader. */
    private getAvailableKeys(group: string[]): string[] {
        return group.filter((key) => this.invaders?.getInvaderAtSlot(key)?.active);
    }

    /** Current set is finished: start the next set, or begin the stage's completion cooldown. */
    private endCurrentSet(): void {
        this.currentGroupSetIndex++;

        if (this.currentGroupSetIndex >= this.numGroups) {
            // end stage here:
            this.completionCooldown = this.coolDownPeriod;
            return;
        }

        // new group attack
        this.setUpAGroupAttack();
        this.setIterations = 0;
    }

    protected override onCooldownElapsed(): void {
        this._isComplete = true;
    }

    setUpAGroupAttack(): void {

        // set the current group attack set based on the current group index
        // this contains a key to the group attack set and the number of iterations
        // it should play.
        this.currentGroupAttackSet = this.groupAttackSet[this.currentGroupSetIndex];

        // get the attack type and iterations from the current group attack set
        // so we now have the the attack set and the number of times it should play.

        // number of times this group attach should play
        this.maxSetIterations = this.currentGroupAttackSet?.[ATTACK_GROUP_ITERATIONS] ?? 0;


        // type of group attack to perform
        this.groupAttackType = this.currentGroupAttackSet?.[ATTACK_GROUP_TYPE] ?? "";

        // this retrieves sets of invaders for the specified group attack type
        // ie. sets of 2 x 2 invaders
        this.invaderGroups = this.shuffleArray(GroupAttackSets.get(this.groupAttackType as GroupType) || []);

        // this is now a list of keys to the formation's invader map and can be
        // used to trigger the corresponding invaders in the formation.
        this.currentInvaderGroup = this.invaderGroups.pop();
    }

    setAttackOffsets(attackGroup: string[] | undefined): void {
        // Calculate and set the offsets for each invader in the group relative to the central position

        this.centralPosition = this.getCentralPosition(attackGroup ?? []);
        attackGroup?.forEach(invaderKey => {
            const invader = this.invaders?.getInvaderAtSlot(invaderKey);
            if (invader) {
                invader.attackOffset = {
                    x: invader.position.x - this.centralPosition.x,
                    y: invader.position.y - this.centralPosition.y,
                    z: invader.position.z - this.centralPosition.z,
                };
            }
        });
    }

    getCentralPosition(attackGroup: string[]): Vector3 {
        let sumX = 0, sumY = 0, sumZ = 0;
        let count = 0;
        attackGroup.forEach(invaderKey => {
            const invader = this.invaders?.getInvaderAtSlot(invaderKey);
            if (invader) {
                sumX += invader.position.x;
                sumY += invader.position.y;
                sumZ += invader.position.z;
                count++;
            }
        });
        // Average over the invaders actually found, not the group size.
        if (count === 0) return new Vector3();
        return new Vector3(sumX / count, sumY / count, sumZ / count);
    }

    // Fisher-Yates shuffle
    shuffleArray(arrayA: IInvaderGroup[]): IInvaderGroup[] {
        // 1. Fast shallow clone (A remains untouched)
        const B = [...arrayA];

        // 2. In-place Fisher-Yates shuffle on B
        for (let i = B.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [B[i], B[j]] = [B[j], B[i]]; // Fast swap
        }

        return B;
    }

    public override isComplete(): boolean {
        return this._isComplete;
    }
}
