

import type { EventBus } from '../core/EventBus';

/** All roll buckets of one model, baked for one mover radius. */
export class AudioEventTrigger {

    private readonly eventBus: EventBus;
    private readonly audioPlayer: AudioPlayer;

    constructor(eventBuss: EventBus, audioPlayer: AudioPlayer) {
        this.eventBus = eventBuss;
        this.audioPlayer = audioPlayer;
    }


}
