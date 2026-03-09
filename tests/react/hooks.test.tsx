// @vitest-environment jsdom

import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextClip, Timeline } from '@/index';
import { Preview, useClips, useExport, usePlayback, useTimeline } from '@/react';
import { installCanvasMock } from '../helpers';

describe('react preview hooks', () => {
  beforeEach(() => {
    installCanvasMock();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('returns a stable timeline instance', () => {
    const { result, rerender } = renderHook(() => useTimeline({ width: 1280, height: 720, fps: 30 }));
    const firstTimeline = result.current;

    rerender();

    expect(result.current).toBe(firstTimeline);
  });

  it('updates clip state through the hook surface', () => {
    const { result } = renderHook(() => {
      const timeline = useTimeline({ width: 1280, height: 720, fps: 30 });
      const clips = useClips(timeline);
      return { timeline, clips };
    });

    act(() => {
      result.current.timeline.add(new TextClip({
        start: 0,
        duration: 2,
        text: 'hook clip',
      }));
    });

    expect(result.current.clips).toHaveLength(1);
    expect(result.current.clips[0].kind).toBe('text');
  });

  it('tracks playback state and mounts the Preview component', () => {
    const { result } = renderHook(() => {
      const timeline = useTimeline({ width: 1280, height: 720, fps: 30 });
      const playback = usePlayback(timeline);
      return { timeline, playback };
    });

    act(() => {
      result.current.timeline.add(new TextClip({
        start: 0,
        duration: 2,
        text: 'hello',
      }));
      result.current.playback.play();
    });

    expect(result.current.playback.isPlaying).toBe(true);

    const view = render(<Preview timeline={result.current.timeline} />);
    expect(view.container.querySelector('canvas')).not.toBeNull();

    act(() => {
      result.current.playback.pause();
    });

    expect(result.current.playback.isPlaying).toBe(false);
  });

  it('runs export through the hook surface', async () => {
    const { result } = renderHook(() => {
      const timeline = useTimeline({ width: 1280, height: 720, fps: 30 });
      const exporter = useExport(timeline);
      return { timeline, exporter };
    });

    const exportSpy = vi.spyOn(result.current.timeline, 'export').mockImplementation(async (options) => {
      options?.onProgress?.(0.25);
      options?.onProgress?.(1);

      return {
        blob: new Blob(['video'], { type: 'video/mp4' }),
        url: 'blob:hook-export',
        duration: 2,
        stats: {
          totalFrames: 60,
          encodingTimeMs: 90,
          fileSizeBytes: 5,
        },
      };
    });

    let exportResult: Awaited<ReturnType<typeof result.current.exporter.exportVideo>> | undefined;
    await act(async () => {
      exportResult = await result.current.exporter.exportVideo();
    });

    expect(exportSpy).toHaveBeenCalledOnce();
    expect(exportSpy.mock.calls[0]?.[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(exportResult?.url).toBe('blob:hook-export');
    expect(result.current.exporter.isExporting).toBe(false);
    expect(result.current.exporter.progress).toBeNull();
    expect(result.current.exporter.error).toBeNull();
  });

  it('resets playback state when the caller swaps timeline instances', async () => {
    const first = new Timeline({ width: 1280, height: 720, fps: 30 });
    first.add(new TextClip({
      start: 0,
      duration: 2,
      text: 'first',
    }));
    first.seek(1.25);
    first.play();

    const second = new Timeline({ width: 1280, height: 720, fps: 30 });
    second.add(new TextClip({
      start: 0,
      duration: 2,
      text: 'second',
    }));
    second.seek(0.4);

    const { result, rerender } = renderHook(({ timeline }) => usePlayback(timeline), {
      initialProps: { timeline: first },
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.currentTime).toBeCloseTo(1.25, 3);
    });

    rerender({ timeline: second });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentTime).toBeCloseTo(0.4, 3);
    });

    first.pause();
  });

  it('updates the Preview shell aspect ratio when the timeline resolution changes', () => {
    const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });
    const view = render(<Preview timeline={timeline} />);
    const shell = view.container.firstElementChild as HTMLElement;

    expect(shell.style.aspectRatio).toBe('1280 / 720');

    act(() => {
      timeline.setResolution(640, 360);
    });

    expect(shell.style.aspectRatio).toBe('640 / 360');
  });

  it('destroys hook-owned timelines on unmount', () => {
    const { result, unmount } = renderHook(() => useTimeline({ width: 1280, height: 720, fps: 30 }));
    const destroySpy = vi.spyOn(result.current, 'destroy');

    unmount();

    expect(destroySpy).toHaveBeenCalledOnce();
  });
});
