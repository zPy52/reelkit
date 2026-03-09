import { describe, expect, it, vi } from 'vitest';
import { AudioClip } from '@/index';
import { MediaPool } from '@/renderer/media-pool';

describe('MediaPool', () => {
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
});
