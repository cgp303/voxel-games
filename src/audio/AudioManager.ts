import { Howl } from 'howler';
import { AUDIO_PATHS } from '../assets/manifests';
import type { TrackLoad } from '../ui/Preloader';


export class AudioManager {
    private sounds = new Map<string, Howl>();
    private baseVolume = new Map<string, number>();

    /**
     * Creates every sound and waits for those marked `preload`, counting each with `track` if given. Sounds not marked
     * `preload` are created unloaded; call loadBackground() to fetch them. A sound that fails to load is logged and
     * counted as done, so the preload never stalls.
     */
    async preload(track: TrackLoad = (load) => load): Promise<void> {
        const loads: Promise<void>[] = [];
        for (const [id, asset] of Object.entries(AUDIO_PATHS)) {
            this.baseVolume.set(id, asset.volume);
            let settle: () => void = () => {};
            const loaded = new Promise<void>((resolve) => (settle = resolve));
            const sound = new Howl({
                src: [asset.src],
                volume: asset.volume,
                loop: asset.loop,
                preload: asset.preload,
                onload: () => settle(),
                onloaderror: (_soundId, err) => {
                    console.error(`[AudioManager] could not load "${id}" (${asset.src}):`, err);
                    settle();
                },
            });
            this.sounds.set(id, sound);
            if (asset.preload) loads.push(track(loaded));
        }

        await Promise.all(loads);
    }

    /** Starts loading every sound not marked `preload`. One played before it has loaded starts once it has. */
    loadBackground(): void {
        for (const [id, asset] of Object.entries(AUDIO_PATHS)) {
            if (asset.preload) continue;
            const sound = this.sounds.get(id);
            if (sound && sound.state() === 'unloaded') sound.load();
        }
    }

    play(id: string): void {
        const sound = this.sounds.get(id);
        if (!sound) return;
        // Cancel any fade-out still pending from an earlier run, and restore full volume.
        sound.off('fade');
        // play() always starts a new instance; stop a loop first so a restart never overlaps one still fading.
        if (sound.loop()) sound.stop();
        sound.volume(this.baseVolume.get(id) ?? 1);
        sound.play();
    }

    /** Ramps the sound to silence, then stops it and restores its volume for the next play. */
    fade(id: string, durationMs = 1000): void {
        const sound = this.sounds.get(id);
        if (!sound) return;
        const from = sound.volume();
        const restore = this.baseVolume.get(id) ?? from;
        sound.once('fade', () => {
            sound.stop();
            sound.volume(restore);
        });
        sound.fade(from, 0, durationMs);
    }

    /** Stops the sound immediately. */
    stop(id: string): void {
        const sound = this.sounds.get(id);
        if (!sound) return;
        sound.off('fade');
        sound.stop();
        sound.volume(this.baseVolume.get(id) ?? 1);
    }
}