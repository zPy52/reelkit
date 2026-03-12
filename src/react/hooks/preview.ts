import { useEffect, useRef } from 'react';
import type { PreviewHandle, PreviewOptions } from '../../renderer/canvas-renderer';
import type { Timeline } from '../../timeline';
import type { UsePreviewResult } from './types';
import { SubmodulePreviewHooksPlayback } from './playback';

const playbackHooks = new SubmodulePreviewHooksPlayback();

export class SubmodulePreviewHooksPreview {
  public use(timeline: Timeline, previewOptions?: PreviewOptions): UsePreviewResult {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const handleRef = useRef<PreviewHandle | null>(null);
    const mountedContainerRef = useRef<HTMLDivElement | null>(null);
    const mountedTimelineRef = useRef<Timeline | null>(null);
    const mountedOptionsRef = useRef<PreviewOptions | undefined>(undefined);
    const playback = playbackHooks.use(timeline);

    useEffect(() => {
      const container = containerRef.current;
      const canReuseHandle = handleRef.current
        && mountedContainerRef.current === container
        && mountedTimelineRef.current === timeline
        && mountedOptionsRef.current === previewOptions;

      if (canReuseHandle) {
        return;
      }

      handleRef.current?.destroy();
      handleRef.current = null;
      mountedContainerRef.current = null;
      mountedTimelineRef.current = null;
      mountedOptionsRef.current = undefined;

      if (!container) {
        return;
      }

      handleRef.current = timeline.mountPreview(container, previewOptions);
      mountedContainerRef.current = container;
      mountedTimelineRef.current = timeline;
      mountedOptionsRef.current = previewOptions;
    });

    useEffect(() => {
      return () => {
        handleRef.current?.destroy();
        handleRef.current = null;
        mountedContainerRef.current = null;
        mountedTimelineRef.current = null;
        mountedOptionsRef.current = undefined;
      };
    }, []);

    return {
      ref: containerRef,
      ...playback,
    };
  }
}
