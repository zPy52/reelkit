export type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type RelativeValue = `${number}%`;

export type Source = string | URL;

export interface Placement {
  x?: number | RelativeValue;
  y?: number | RelativeValue;
  width?: number | RelativeValue;
  height?: number | RelativeValue;
  anchor?: Anchor;
  rotation?: number;
  opacity?: number;
}

export interface BaseClipOptions {
  id?: string;
  start: number;
  duration: number;
  in?: number;
  out?: number;
  track?: number;
}

export interface VideoClipOptions extends BaseClipOptions {
  src: Source;
  placement?: Placement;
  audio?: boolean;
  muted?: boolean;
  volume?: number;
}

export interface ImageClipOptions extends BaseClipOptions {
  src: Source;
  placement?: Placement;
}

export interface AudioClipOptions extends BaseClipOptions {
  src: Source;
  volume?: number;
  muted?: boolean;
  mediaTag?: 'audio' | 'video';
  linkedClipId?: string;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  lineHeight?: number;
  color?: string;
  backgroundColor?: string;
  align?: CanvasTextAlign;
  padding?: number;
  letterSpacing?: number;
}

export interface TextClipOptions extends BaseClipOptions {
  text: string;
  placement?: Placement;
  style?: TextStyle;
}

export interface EffectClipOptions extends BaseClipOptions {
  effect: string;
  params?: Record<string, unknown>;
}

export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'effect';
