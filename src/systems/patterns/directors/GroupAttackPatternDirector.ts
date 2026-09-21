// systems/patterns/directors/GroupAttackPatternDirector.ts

import { GroupAttackPatternBuilder } from '../patterns/GroupAttackPatternBuilder';
import type { DirectorContext, PatternDirector } from '../interfaces';
import { groupAttackSets as GroupAttackSets, GroupType, InvaderGroup } from '../config/GroupAttackSets';

const ATTACK_GROUP_TYPE = 0;
const ATTACK_GROUP_ITERATIONS = 1;

export class GroupAttackPatternDirector implements PatternDirector {

    public queueRemaining = 0;
    private running = false;
    private cancelled = false;
    private formation;
    private invaders;
    private config;
    private builder;
    private invaderGroups;
    private timeSinceLastTrigger = 0;
    private completionCooldown = 0;
    private coolDownPeriod = 5.2; // example value in milliseconds
    private _isComplete = false;
    private triggerDelay = 5.2; // time between triggers

    private groupAttackSet: [string, number][];
    private currentGroupSetIndex = 0;
    private currentGroupAttackSet: [string, number] | undefined;
    private maxSetIterations: number = 0;
    private numGroups: number;
    private groupAttackType: string = "";
    private currentInvaderGroup: InvaderGroup | undefined;
    private setIterations: number = 0;



    constructor(groupAttackSet: [string, number][]) {

        // instructions from the stage-queue
        // about what kinds of group attack to perform
        // and in what order
        this.groupAttackSet = groupAttackSet;

        // store the number of groups for later reference
        this.numGroups = groupAttackSet.length;
    }

    begin(ctx: DirectorContext): void {
        this.running = true;
        this.cancelled = false;
        this.formation = ctx.formation;
        this.invaders = ctx.invaders;
        this.config = ctx.config ?? {};
        this.builder = new GroupAttackPatternBuilder(ctx.scene);

        // reset set index
        this.currentGroupSetIndex = 0;

        // set the current group attack set based on the current group index
        // this contains a key to the group attack set and the number of iterations
        // it should play.
        this.currentGroupAttackSet = this.groupAttackSet[this.currentGroupSetIndex];

        // get the attack type and iterations from the current group attack set
        // so we now have the the attack set and the number of times it should play.

        // number of times this group attach should play
        this.maxSetIterations = this.currentGroupAttackSet?.[ATTACK_GROUP_ITERATIONS] ?? 0;
        this.setIterations = 0;

        // type of group attack to perform
        this.groupAttackType = this.currentGroupAttackSet?.[ATTACK_GROUP_TYPE] ?? "";

        // this retrieves sets of invaders for the specified group attack type
        // ie. sets of 2 x 2 invaders
        this.invaderGroups = this.shuffleArray(GroupAttackSets.get(this.groupAttackType as GroupType) || []);

        // this is now a list of keys to the formation's invader map and can be
        // used to trigger the corresponding invaders in the formation.
        this.currentInvaderGroup = this.invaderGroups.pop();


        this._isComplete = false
        this.timeSinceLastTrigger = 0;
        this.completionCooldown = 0; // reset completion cooldown on begin

    }

    update(dt: number): void {

        ////////////////////////////////////////////
        // First deal with timing:
        ////////////////////////////////////////////

        // return if not active
        if (!this.running || this.cancelled) return;

        // return if in completion cooldown
        if (this.completionCooldown > 0) {
            this.completionCooldown -= dt;
            if (this.completionCooldown <= 0) {
                this._isComplete = true;
            }
            return;
        }

        // // pause between invader triggers
        this.timeSinceLastTrigger += dt;
        if (this.timeSinceLastTrigger < this.triggerDelay) return;

        // reset time since last trigger
        this.timeSinceLastTrigger = 0;

        // release group of invaders
        // release group of invaders
        const attackGroup = this.currentInvaderGroup?.group;
        const path = this.currentInvaderGroup?.path;
        const side = path === "left" ? 0 : path === "right" ? 1 : Math.random() < 0.5 ? 0 : 1;


        attackGroup?.forEach((invaderKey) => {
            //const slot = this.formation.getSlotByKey(invaderKey);
            const invader = this.invaders.getInvaderAtSlot(invaderKey);
            if (invader && invader.active) {
                const pattern = this.builder.build(invader, side);
                invader.startPattern({
                    pattern,
                    formation: this.formation,
                    entry: this.config.orientation,
                });
            }
        });

        // prepare for the next set iteration
        this.setIterations++;
        if (this.setIterations >= this.maxSetIterations) {
            this.currentGroupSetIndex++;

            if (this.currentGroupSetIndex >= this.numGroups) {
                // end stage here:
                this.completionCooldown = this.coolDownPeriod;

                //
                return;

            }
            // otherwise set up a new group attack set
            this.currentGroupAttackSet = this.groupAttackSet[this.currentGroupSetIndex];

            // number of repeats
            this.maxSetIterations = this.currentGroupAttackSet?.[ATTACK_GROUP_ITERATIONS];

            // type of group attack to perform
            this.groupAttackType = this.currentGroupAttackSet?.[ATTACK_GROUP_TYPE];

            // this retrieves sets of invaders for the specified group attack type
            // ie. sets of 2 x 2 invaders
            this.invaderGroups = this.shuffleArray(GroupAttackSets.get(this.groupAttackType as GroupType) || []);

            // this is now a list of keys to the formation's invader map and can be
            // used to trigger the corresponding invaders in the formation.
            this.currentInvaderGroup = this.invaderGroups.pop();

            console.log("Selected invader group: ", this.groupAttackType, "with invaders ", this.currentInvaderGroup);

            // prepare for a new set
            this.setIterations = 0;

            return;
        } else {

            this.currentInvaderGroup = this.invaderGroups.pop();
        }
    }

    // Fisher-Yates shuffle
    shuffleArray(arrayA: InvaderGroup[]): InvaderGroup[] {
        // 1. Fast shallow clone (A remains untouched)
        const B = [...arrayA];

        // 2. In-place Fisher-Yates shuffle on B
        for (let i = B.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [B[i], B[j]] = [B[j], B[i]]; // Fast swap
        }

        return B;
    }

    /*
    // Cancel the director's operation
    */
    cancel(): void {
        this.cancelled = true;
        this.running = false;
    }

    isRunning(): boolean {
        return this.running;
    }

    isCancelled(): boolean {
        return this.cancelled;
    }

    isComplete(): boolean {
        return this._isComplete;
    }
}
