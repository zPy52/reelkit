// @vitest-environment jsdom

import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextClip } from '@/index';
import { Preview, useClips, usePlayback, useTimeline } from '@/react';
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
});
