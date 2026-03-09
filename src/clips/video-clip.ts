import { BaseClip } from './base-clip';
import type { Placement, Source, VideoClipOptions } from './types';

const DEFAULT_PLACEMENT: Placement = {
  x: '50%',
  y: '50%',
  anchor: 'center',
  opacity: 1,
  rotation: 0,
};

export class VideoClip extends BaseClip {
  public readonly kind = 'video' as const;
  public src: Source;
  public placement: Placement;
  public audio: boolean;
  public muted: boolean;
  public volume: number;

  public constructor(options: VideoClipOptions) {
    super(options, 'video');
    this.src = options.src;
    this.placement = { ...DEFAULT_PLACEMENT, ...options.placement };
    this.audio = options.audio ?? true;
    this.muted = options.muted ?? false;
    this.volume = options.volume ?? 1;
  }
}
