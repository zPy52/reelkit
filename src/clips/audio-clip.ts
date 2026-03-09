import { BaseClip } from './base-clip';
import type { AudioClipOptions, Source } from './types';

export class AudioClip extends BaseClip {
  public readonly kind = 'audio' as const;
  public src: Source;
  public volume: number;
  public muted: boolean;
  public mediaTag: 'audio' | 'video';
  public linkedClipId?: string;

  public constructor(options: AudioClipOptions) {
    super(options, 'audio');
    this.src = options.src;
    this.volume = options.volume ?? 1;
    this.muted = options.muted ?? false;
    this.mediaTag = options.mediaTag ?? 'audio';
    this.linkedClipId = options.linkedClipId;
  }
}
