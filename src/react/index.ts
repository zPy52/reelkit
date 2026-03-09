import type { Timeline } from '../timeline';
import { PreviewHooks } from './hooks';

export { Preview } from './preview-component';
export { PreviewHooks } from './hooks';
export type {
  PreviewHooksOptions,
  UseClipsResult,
  UseExportResult,
  UsePlaybackResult,
  UsePreviewResult,
  UseTimelineOptions,
} from './hooks';

export function useTimeline(options: ConstructorParameters<typeof Timeline>[0]) {
  return PreviewHooks.timeline.use(options);
}

export function usePlayback(timeline: Timeline) {
  return PreviewHooks.playback.use(timeline);
}

export function useClips(timeline: Timeline) {
  return PreviewHooks.clips.use(timeline);
}

export function useExport(timeline: Timeline) {
  return PreviewHooks.export.use(timeline);
}

export function usePreview(timeline: Timeline, previewOptions?: Parameters<typeof PreviewHooks.preview.use>[1]) {
  return PreviewHooks.preview.use(timeline, previewOptions);
}
