export { AudioClip } from './audio-clip';
export { BaseClip } from './base-clip';
export { EffectClip } from './effect-clip';
export { ImageClip } from './image-clip';
export { TextClip } from './text-clip';
export type {
  Anchor,
  AudioClipOptions,
  BaseClipOptions,
  ClipKind,
  EffectClipOptions,
  ImageClipOptions,
  Placement,
  RelativeValue,
  Source,
  TextClipOptions,
  TextStyle,
  VideoClipOptions,
} from './types';
export { VideoClip } from './video-clip';

import type { AudioClip } from './audio-clip';
import type { EffectClip } from './effect-clip';
import type { ImageClip } from './image-clip';
import type { TextClip } from './text-clip';
import type { VideoClip } from './video-clip';

export type Clip = VideoClip | ImageClip | AudioClip | TextClip | EffectClip;
