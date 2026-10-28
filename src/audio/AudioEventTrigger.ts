

import type { EventBus } from '../core/EventBus';
//import { Howler } from 'howler';
import { AUDIO } from '../config/data/constants';
import { GameEvents } from '../config/types/types';
import { AudioManager } from './AudioManager';

/** All roll buckets of one model, baked for one mover radius. */
export class AudioEventTrigger {

    private readonly eventBus: EventBus;
    private readonly audioManager: AudioManager;
    private unsubscribers: Array<() => void>;

    constructor(eventBus: EventBus, audioManager: AudioManager) {
        this.eventBus = eventBus;
        this.audioManager = audioManager;
        this.unsubscribers = [];
    }

    attach() {
        for (const [key, sound] of Object.entries(AUDIO)) {
            const eventName = GameEvents[key as keyof typeof GameEvents];
            const off = this.eventBus.on(eventName, (payload) => this.handle(key, sound, payload));
            this.unsubscribers.push(off);
        }
    }

    private handle(key: string, sound: string, payload: any) {
        switch (key) {
            case 'minePassed':
                this.audioManager.fade('mineActivated');
                break;
            case 'mineCleared':
                this.audioManager.stop('mineActivated');
                break;
            case 'mineDestroyed':
                if (payload?.wasLast) this.audioManager.stop('mineActivated');
                this.audioManager.play(key);
                break;
            case 'boss1LazerOff':
                this.audioManager.stop(AUDIO.boss1LazerOn || '');
                break;
            case 'astroForcePsyEnd':
                this.audioManager.fade('astroForcePsy', 200);
                break;
            case 'gameStart':
                this.audioManager.play(key);
                // this.audioManager.playThen(key, 'astroInGame');
                break;
            case 'gameOverAssembly':
                // this.audioManager.fade('astroInGame', 800);
                this.audioManager.play(key);
                break;
            default:
                this.audioManager.play(key);
                break;
        }

        console.log(`Handling audio event for key: ${key}, sound: ${sound}`, payload);
    }

    // helper function to select a post fix for invader weapon audio events
    private randomLetter(): 'a' | 'b' | 'c' | 'd' {
        const letters = ['a', 'b', 'c', 'd'] as const;
        return letters[Math.floor(Math.random() * letters.length)];
    }


    detach() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
    }
}
