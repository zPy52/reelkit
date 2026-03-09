import { BaseClip } from './base-clip';
import type { ImageClipOptions, Placement, Source } from './types';

const DEFAULT_PLACEMENT: Placement = {
  x: '50%',
  y: '50%',
  anchor: 'center',
  opacity: 1,
  rotation: 0,
};

export class ImageClip extends BaseClip {
  public readonly kind = 'image' as const;
  public src: Source;
  public placement: Placement;

  public constructor(options: ImageClipOptions) {
    super(options, 'image');
    this.src = options.src;
    this.placement = { ...DEFAULT_PLACEMENT, ...options.placement };
  }
}
