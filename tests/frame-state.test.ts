import { describe, expect, it } from 'vitest';
import { EffectClip, TextClip } from '@/index';
import { getFrameState, resolveRenderTime } from '@/renderer/frame-state';

describe('frame state', () => {
  it('groups track effects with their own track and keeps composition effects separate', () => {
    const clips = [
      new TextClip({
        id: 'base',
        start: 0,
        duration: 4,
        track: 0,
        text: 'base',
      }),
      new TextClip({
        id: 'overlay',
        start: 0,
        duration: 4,
        track: 1,
        text: 'overlay',
      }),
      new EffectClip({
        id: 'track-effect',
        start: 0,
        duration: 4,
        track: 1,
        effect: 'blur',
      }),
      new EffectClip({
        id: 'composition-effect',
        start: 0,
        duration: 4,
        track: -1,
        effect: 'fade',
      }),
    ];

    const state = getFrameState(clips, 1);

    expect(state.trackLayers).toHaveLength(2);
    expect(state.trackLayers[0]).toMatchObject({
      track: 0,
      clips: [clips[0]],
      effects: [],
    });
    expect(state.trackLayers[1]).toMatchObject({
      track: 1,
      clips: [clips[1]],
      effects: [clips[2]],
    });
    expect(state.compositionEffects).toEqual([clips[3]]);
  });

  it('clamps render-only end times to the final visible frame', () => {
    expect(resolveRenderTime(5, 5)).toBeLessThan(5);
    expect(resolveRenderTime(2.5, 5)).toBe(2.5);
  });
});
