// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioClip, VideoClip } from '@/index';
import { MediaPool } from '@/renderer/media-pool';

describe('MediaPool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pauses audio clips once the underlying media has been exhausted', () => {
    const pool = new MediaPool();
    const clip = new AudioClip({
      start: 0,
      duration: 8,
      src: '/audio.mp3',
      volume: 0.8,
    });

    const mediaElement = {
      currentTime: 0,
      duration: 3.24,
      muted: false,
      paused: false,
      volume: 1,
      pause: vi.fn(function pause(this: { paused: boolean }) {
        this.paused = true;
      }),
      play: vi.fn(async function play(this: { paused: boolean }) {
        this.paused = false;
      }),
    } as unknown as HTMLMediaElement;

    vi.spyOn(pool, 'getAudioElement').mockReturnValue(mediaElement);

    pool.syncAudio(clip, 4, true);

    expect(mediaElement.currentTime).toBeCloseTo(3.239, 3);
    expect(mediaElement.pause).toHaveBeenCalledTimes(1);
    expect(mediaElement.play).not.toHaveBeenCalled();
    expect(mediaElement.volume).toBeCloseTo(0.8, 3);
  });

  it('does not spam play calls while audio is already playing', () => {
    const pool = new MediaPool();
    const clip = new AudioClip({
      start: 0,
      duration: 8,
      src: '/audio.mp3',
      volume: 0.8,
    });

    const mediaElement = {
      currentTime: 1,
      duration: 3.24,
      muted: false,
      paused: false,
      volume: 1,
      pause: vi.fn(),
      play: vi.fn(async () => undefined),
    } as unknown as HTMLMediaElement;

    vi.spyOn(pool, 'getAudioElement').mockReturnValue(mediaElement);

    pool.syncAudio(clip, 1.04, true);

    expect(mediaElement.play).not.toHaveBeenCalled();
    expect(mediaElement.pause).not.toHaveBeenCalled();
  });

  it('keeps duplicate-source video clips independent by clip id', () => {
    const pool = new MediaPool();
    const left = new VideoClip({
      id: 'video-left',
      start: 0,
      duration: 8,
      src: '/shared.mp4',
      audio: false,
    });
    const right = new VideoClip({
      id: 'video-right',
      start: 0,
      duration: 8,
      src: '/shared.mp4',
      audio: false,
    });

    const leftElement = pool.getVideoElement(left);
    const rightElement = pool.getVideoElement(right);

    Object.defineProperties(leftElement, {
      currentTime: { configurable: true, writable: true, value: 0 },
      duration: { configurable: true, writable: true, value: 10 },
      paused: { configurable: true, writable: true, value: true },
    });
    Object.defineProperties(rightElement, {
      currentTime: { configurable: true, writable: true, value: 0 },
      duration: { configurable: true, writable: true, value: 10 },
      paused: { configurable: true, writable: true, value: true },
    });

    leftElement.play = vi.fn(async function play(this: HTMLVideoElement & { paused: boolean }) {
      this.paused = false;
    });
    leftElement.pause = vi.fn(function pause(this: HTMLVideoElement & { paused: boolean }) {
      this.paused = true;
    });
    rightElement.play = vi.fn(async function play(this: HTMLVideoElement & { paused: boolean }) {
      this.paused = false;
    });
    rightElement.pause = vi.fn(function pause(this: HTMLVideoElement & { paused: boolean }) {
      this.paused = true;
    });

    expect(leftElement).not.toBe(rightElement);

    pool.syncVideo(left, 1.25, true);
    pool.syncVideo(right, 4.5, true);

    expect(leftElement.currentTime).toBeCloseTo(1.25, 3);
    expect(rightElement.currentTime).toBeCloseTo(4.5, 3);
    expect(leftElement.play).toHaveBeenCalledTimes(1);
    expect(rightElement.play).toHaveBeenCalledTimes(1);
  });

  it('refreshes media elements when a clip source changes without reusing the old element', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);

    const pool = new MediaPool();
    const clip = new VideoClip({
      id: 'video-source-swap',
      start: 0,
      duration: 4,
      src: '/original.mp4',
      audio: false,
    });

    const firstElement = pool.getVideoElement(clip);
    clip.src = '/updated.mp4';
    const secondElement = pool.getVideoElement(clip);

    expect(secondElement).not.toBe(firstElement);
    expect(secondElement.getAttribute('src')).toContain('/updated.mp4');
  });
});
