import type { AudioClip, Clip, EffectClip } from '../clips';

export type RenderableClip = Exclude<Clip, { kind: 'audio' | 'effect' }>;

export interface TrackLayer {
  track: number;
  clips: readonly RenderableClip[];
  effects: readonly EffectClip[];
}

export interface FrameState {
  activeClips: readonly Clip[];
  audioClips: readonly AudioClip[];
  trackLayers: readonly TrackLayer[];
  compositionEffects: readonly EffectClip[];
}

function sortByStartThenId<TClip extends { id: string; start: number }>(clips: readonly TClip[]): TClip[] {
  return [...clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}

export function getFrameState(clips: readonly Clip[], time: number): FrameState {
  const activeClips = clips.filter((clip) => clip.includes(time));
  const audioClips = activeClips.filter((clip): clip is AudioClip => clip.kind === 'audio');
  const mediaClips = sortByStartThenId(
    activeClips.filter((clip): clip is RenderableClip => clip.kind !== 'audio' && clip.kind !== 'effect'),
  );
  const effectClips = sortByStartThenId(
    activeClips.filter((clip): clip is EffectClip => clip.kind === 'effect'),
  );
  const compositionEffects = effectClips.filter((clip) => clip.track < 0);
  const trackNumbers = Array.from(
    new Set(
      mediaClips
        .map((clip) => clip.track)
        .concat(effectClips.map((clip) => clip.track).filter((track) => track >= 0)),
    ),
  ).sort((left, right) => left - right);

  return {
    activeClips,
    audioClips,
    trackLayers: trackNumbers.map((track) => {
      return {
        track,
        clips: mediaClips.filter((clip) => clip.track === track),
        effects: effectClips.filter((clip) => clip.track === track),
      };
    }),
    compositionEffects,
  };
}

export function resolveRenderTime(time: number, duration: number, epsilon = 0.0001): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, time);
  }

  const clamped = Math.max(0, Math.min(time, duration));
  if (clamped < duration) {
    return clamped;
  }

  return Math.max(0, duration - epsilon);
}
