import { BaseClip } from './base-clip';
import type { EffectClipOptions } from './types';

export class EffectClip extends BaseClip {
  public readonly kind = 'effect' as const;
  public effect: string;
  public params?: Record<string, unknown>;

  public constructor(options: EffectClipOptions) {
    super(options, 'effect');
    this.effect = options.effect;
    this.params = options.params;
  }
}
