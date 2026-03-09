import { useEffect, useRef } from 'react';
import type { Timeline } from '../../timeline';
import type { PreviewOptions } from '../../renderer/canvas-renderer';
import type { UsePreviewResult } from './types';
import { SubmodulePreviewHooksPlayback } from './playback';

const playbackHooks = new SubmodulePreviewHooksPlayback();

export class SubmodulePreviewHooksPreview {
  public use(timeline: Timeline, previewOptions?: PreviewOptions): UsePreviewResult {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playback = playbackHooks.use(timeline);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const handle = timeline.mountPreview(container, previewOptions);
      return () => {
        handle.destroy();
      };
    }, [previewOptions, timeline]);

    return {
      ref: containerRef,
      ...playback,
    };
  }
}
