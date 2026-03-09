import { SubmodulePreviewHooksClips } from './clips';
import { SubmodulePreviewHooksPlayback } from './playback';
import { SubmodulePreviewHooksPreview } from './preview';
import { SubmodulePreviewHooksTimeline } from './timeline';

export class PreviewHooks {
  public static readonly clips = new SubmodulePreviewHooksClips();
  public static readonly playback = new SubmodulePreviewHooksPlayback();
  public static readonly preview = new SubmodulePreviewHooksPreview();
  public static readonly timeline = new SubmodulePreviewHooksTimeline();
}

export type {
  PreviewHooksOptions,
  UseClipsResult,
  UsePlaybackResult,
  UsePreviewResult,
  UseTimelineOptions,
} from './types';
