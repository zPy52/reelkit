import type { AudioClip } from '../clips';
import { MediaPool } from '../renderer/media-pool';

export class AudioEngine {
  public constructor(private readonly pool: MediaPool) {}

  public sync(clips: readonly AudioClip[], time: number, playing: boolean): void {
    for (const clip of clips) {
      this.pool.syncAudio(clip, time, playing);
    }
  }

  public pause(): void {
    this.pool.pauseInactiveClips([]);
  }

  public destroy(): void {
    this.pause();
  }
}
