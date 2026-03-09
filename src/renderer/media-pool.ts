import type { AudioClip, Clip, ImageClip, Source, VideoClip } from '../clips';

function toSourceString(source: Source): string {
  return source instanceof URL ? source.href : source;
}

function clampTime(value: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, value);
  }

  return Math.max(0, Math.min(value, Math.max(0, duration - 0.001)));
}

function getPlayableWindow(
  clip: Pick<AudioClip | VideoClip, 'in' | 'out'>,
  mediaDuration: number,
): { sourceStart: number; sourceEnd?: number } {
  const sourceStart = Math.max(0, clip.in ?? 0);
  const clipOut = typeof clip.out === 'number' ? Math.max(sourceStart, clip.out) : undefined;
  const boundedMediaDuration = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : undefined;

  if (typeof clipOut === 'number' && typeof boundedMediaDuration === 'number') {
    return { sourceStart, sourceEnd: Math.min(clipOut, boundedMediaDuration) };
  }

  return { sourceStart, sourceEnd: clipOut ?? boundedMediaDuration };
}

function createTrackedMediaElement<TElement extends HTMLMediaElement>(
  element: TElement,
  src: string,
  onInvalidate?: () => void,
): TElement {
  element.src = src;
  element.preload = 'auto';
  element.crossOrigin = 'anonymous';

  const events = ['loadeddata', 'loadedmetadata', 'canplay', 'seeked'];
  for (const eventName of events) {
    element.addEventListener(eventName, () => {
      onInvalidate?.();
    });
  }

  return element;
}

export class MediaPool {
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly audios = new Map<string, HTMLMediaElement>();

  public constructor(private readonly onInvalidate?: () => void) {}

  public getVideoElement(source: Source): HTMLVideoElement {
    const src = toSourceString(source);

    if (!this.videos.has(src)) {
      const element = createTrackedMediaElement(document.createElement('video'), src, this.onInvalidate);
      element.muted = true;
      element.defaultMuted = true;
      element.playsInline = true;
      this.videos.set(src, element);
    }

    return this.videos.get(src)!;
  }

  public getImageElement(source: Source): HTMLImageElement {
    const src = toSourceString(source);

    if (!this.images.has(src)) {
      const element = new Image();
      element.src = src;
      element.crossOrigin = 'anonymous';
      element.addEventListener('load', () => {
        this.onInvalidate?.();
      });
      this.images.set(src, element);
    }

    return this.images.get(src)!;
  }

  public getAudioElement(clip: AudioClip): HTMLMediaElement {
    const src = toSourceString(clip.src);
    const key = `${clip.mediaTag}:${src}`;

    if (!this.audios.has(key)) {
      const tagName = clip.mediaTag === 'video' ? 'video' : 'audio';
      const element = createTrackedMediaElement(
        document.createElement(tagName) as HTMLMediaElement,
        src,
        this.onInvalidate,
      );
      element.playsInline = true;
      if (element instanceof HTMLVideoElement) {
        element.playsInline = true;
      }
      this.audios.set(key, element);
    }

    return this.audios.get(key)!;
  }

  public syncVideo(clip: VideoClip, time: number, playing: boolean): HTMLVideoElement {
    const element = this.getVideoElement(clip.src);
    const { sourceStart, sourceEnd } = getPlayableWindow(clip, element.duration);
    const localTime = Math.max(sourceStart, time - clip.start + sourceStart);
    const shouldPlay = playing && (typeof sourceEnd !== 'number' || localTime < sourceEnd);
    const desiredTime = clampTime(localTime, element.duration);
    const drift = Math.abs((element.currentTime || 0) - desiredTime);

    if (drift > 0.12) {
      element.currentTime = desiredTime;
    }

    if (shouldPlay && element.paused) {
      void element.play().catch(() => undefined);
    } else if (!shouldPlay && !element.paused) {
      element.pause();
    }

    return element;
  }

  public syncAudio(clip: AudioClip, time: number, playing: boolean): HTMLMediaElement {
    const element = this.getAudioElement(clip);
    const { sourceStart, sourceEnd } = getPlayableWindow(clip, element.duration);
    const localTime = Math.max(sourceStart, time - clip.start + sourceStart);
    const shouldPlay = playing && (typeof sourceEnd !== 'number' || localTime < sourceEnd);
    const desiredTime = clampTime(localTime, element.duration);
    const drift = Math.abs((element.currentTime || 0) - desiredTime);

    element.volume = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume));
    element.muted = clip.muted;

    if (drift > 0.12) {
      element.currentTime = desiredTime;
    }

    if (shouldPlay && element.paused) {
      void element.play().catch(() => undefined);
    } else if (!shouldPlay && !element.paused) {
      element.pause();
    }

    return element;
  }

  public pauseInactiveClips(clips: readonly Clip[]): void {
    const activeVideoSources = new Set(
      clips.filter((clip): clip is VideoClip => clip.kind === 'video').map((clip) => toSourceString(clip.src)),
    );
    const activeAudioSources = new Set(
      clips.filter((clip): clip is AudioClip => clip.kind === 'audio').map((clip) => {
        return `${clip.mediaTag}:${toSourceString(clip.src)}`;
      }),
    );

    for (const [source, element] of this.videos) {
      if (!activeVideoSources.has(source)) {
        element.pause();
      }
    }

    for (const [key, element] of this.audios) {
      if (!activeAudioSources.has(key)) {
        element.pause();
      }
    }
  }

  public destroy(): void {
    for (const element of this.videos.values()) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }

    for (const element of this.audios.values()) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }

    this.videos.clear();
    this.images.clear();
    this.audios.clear();
  }
}
