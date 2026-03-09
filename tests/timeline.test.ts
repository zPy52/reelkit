import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextClip, Timeline, VideoClip } from '@/index';
import { installAnimationFrameMock } from './helpers';

describe('Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installAnimationFrameMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a companion audio clip when adding a video clip with audio enabled', () => {
    const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });
    const clip = new VideoClip({
      start: 0,
      duration: 5,
      src: '/video.mp4',
      audio: true,
    });

    timeline.add(clip);

    const clips = timeline.getClips();
    expect(clips).toHaveLength(2);
    expect(clips[0].kind).toBe('audio');
    expect(clips[1].kind).toBe('video');
    expect(clips[0]).toMatchObject({
      kind: 'audio',
      linkedClipId: clip.id,
      src: '/video.mp4',
    });
  });

  it('keeps companion audio in sync when the source video is updated', () => {
    const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });
    const clip = new VideoClip({
      start: 1,
      duration: 5,
      src: '/video.mp4',
      audio: true,
    });

    timeline.add(clip);
    timeline.updateClip(clip.id, {
      start: 2,
      duration: 7,
      src: '/alt-video.mp4',
      volume: 0.4,
    });

    const [audioClip, videoClip] = timeline.getClips();
    expect(videoClip).toMatchObject({
      kind: 'video',
      start: 2,
      duration: 7,
      src: '/alt-video.mp4',
      volume: 0.4,
    });
    expect(audioClip).toMatchObject({
      kind: 'audio',
      start: 2,
      duration: 7,
      src: '/alt-video.mp4',
      volume: 0.4,
    });
  });

  it('plays, emits time updates, and stops at the composition end', async () => {
    const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });
    timeline.add(new TextClip({
      start: 0,
      duration: 0.08,
      text: 'hello',
    }));

    const events: string[] = [];
    timeline.on('play', () => events.push('play'));
    timeline.on('timeupdate', () => events.push('timeupdate'));
    timeline.on('ended', () => events.push('ended'));

    timeline.play();
    await vi.advanceTimersByTimeAsync(200);

    expect(timeline.playing).toBe(false);
    expect(timeline.currentTime).toBeCloseTo(timeline.getDuration(), 3);
    expect(events[0]).toBe('play');
    expect(events).toContain('timeupdate');
    expect(events.at(-1)).toBe('ended');
  });
});
