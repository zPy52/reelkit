import type { RefObject } from 'react';
import type { Clip } from '../../clips';
import type { ExportOptions, ExportResult } from '../../export';
import type { PreviewOptions } from '../../renderer/canvas-renderer';
import type { Timeline, TimelineOptions } from '../../timeline';

export interface UsePlaybackResult {
  currentTime: number;
  isPlaying: boolean;
  play(startTime?: number): void;
  pause(): void;
  seek(time: number): void;
}

export interface UsePreviewResult extends UsePlaybackResult {
  ref: RefObject<HTMLDivElement | null>;
}

export interface PreviewHooksOptions {
  timeline: Timeline;
  previewOptions?: PreviewOptions;
}

export interface UseExportResult {
  exportVideo(options?: ExportOptions): Promise<ExportResult>;
  cancel(): void;
  progress: number | null;
  isExporting: boolean;
  error: Error | null;
}

export type UseTimelineOptions = TimelineOptions;
export type UseClipsResult = readonly Clip[];
