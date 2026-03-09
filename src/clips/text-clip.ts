import { BaseClip } from './base-clip';
import type { Placement, TextClipOptions, TextStyle } from './types';

const DEFAULT_PLACEMENT: Placement = {
  x: '50%',
  y: '50%',
  anchor: 'center',
  opacity: 1,
  rotation: 0,
};

const DEFAULT_STYLE: TextStyle = {
  fontFamily: 'Georgia, Baskerville, serif',
  fontSize: 48,
  fontWeight: 600,
  lineHeight: 1.2,
  color: '#ffffff',
  align: 'left',
  padding: 0,
  letterSpacing: 0,
};

export class TextClip extends BaseClip {
  public readonly kind = 'text' as const;
  public text: string;
  public placement: Placement;
  public style: TextStyle;

  public constructor(options: TextClipOptions) {
    super(options, 'text');
    this.text = options.text;
    this.placement = { ...DEFAULT_PLACEMENT, ...options.placement };
    this.style = { ...DEFAULT_STYLE, ...options.style };
  }
}
