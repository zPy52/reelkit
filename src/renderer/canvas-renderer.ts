import type { AudioClip, Clip, EffectClip } from '../clips';
import { AudioEngine } from '../audio/audio-engine';
import { Compositor } from './compositor';
import { MediaPool } from './media-pool';

export interface PreviewOptions {
  width?: number;
  height?: number;
  pixelRatio?: number;
}

export interface PreviewHandle {
  canvas: HTMLCanvasElement;
  destroy(): void;
  play(startTime?: number): void;
  pause(): void;
  seek(time: number): void;
}

export interface TimelineLike {
  readonly width: number;
  readonly height: number;
  readonly currentTime: number;
  readonly playing: boolean;
  getClips(): readonly Clip[];
  on(event: 'timeupdate', handler: (time: number) => void): () => void;
  on(event: 'clip-added', handler: (clip: Clip) => void): () => void;
  on(event: 'clip-removed', handler: (clip: Clip) => void): () => void;
  on(event: 'clip-changed', handler: (clip: Clip) => void): () => void;
  on(event: 'resolution-changed', handler: (width: number, height: number) => void): () => void;
  on(event: 'play', handler: () => void): () => void;
  on(event: 'pause', handler: () => void): () => void;
  on(event: 'ended', handler: () => void): () => void;
  play(startTime?: number): void;
  pause(): void;
  seek(time: number): void;
}

export class CanvasRenderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly compositor: Compositor;
  private readonly pool: MediaPool;
  private readonly audio: AudioEngine;
  private readonly unsubscribers: Array<() => void> = [];
  private readonly pixelRatio: number;
  private readonly mountedToContainer: boolean;

  public constructor(
    private readonly timeline: TimelineLike,
    container?: HTMLElement,
    options: PreviewOptions = {},
  ) {
    if (typeof document === 'undefined') {
      throw new Error('CanvasRenderer requires a DOM-enabled environment.');
    }

    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    if (!this.context) {
      throw new Error('Unable to acquire a 2D context for the preview canvas.');
    }

    this.pixelRatio = options.pixelRatio ?? window.devicePixelRatio ?? 1;
    this.pool = new MediaPool(() => {
      this.drawFrame(this.timeline.currentTime);
    });
    this.audio = new AudioEngine(this.pool);
    this.compositor = new Compositor(this.pool);

    this.mountedToContainer = Boolean(container);

    if (container) {
      container.replaceChildren(this.canvas);
    }

    this.resizeCanvas(options.width, options.height);
    this.subscribe();
  }

  public drawFrame(time: number): void {
    const canvasSize = { width: this.timeline.width, height: this.timeline.height };
    const activeClips = this.timeline.getClips().filter((clip) => clip.includes(time));
    const audioClips = activeClips.filter((clip): clip is AudioClip => clip.kind === 'audio');
    const mediaClips = activeClips.filter((clip) => clip.kind !== 'audio' && clip.kind !== 'effect');
    const trackEffects = activeClips.filter((clip): clip is EffectClip => clip.kind === 'effect');
    const compositionEffects = trackEffects.filter((clip) => clip.track < 0);
    const groupedTracks = Array.from(
      new Set(mediaClips.map((clip) => clip.track).concat(trackEffects.map((clip) => clip.track).filter((track) => track >= 0))),
    ).sort((left, right) => left - right);

    this.context.clearRect(0, 0, this.timeline.width, this.timeline.height);

    this.audio.sync(audioClips, time, this.timeline.playing);
    this.pool.pauseInactiveClips(activeClips);

    for (const track of groupedTracks) {
      const clipsOnTrack = mediaClips
        .filter((clip) => clip.track === track)
        .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
      for (const clip of clipsOnTrack) {
        this.compositor.draw(this.context, clip, time, canvasSize, this.timeline.playing);
      }

      const effectsOnTrack = trackEffects.filter((clip) => clip.track === track);
      this.compositor.applyEffects(this.context, effectsOnTrack, time, this.canvas);
    }

    this.compositor.applyEffects(this.context, compositionEffects, time, this.canvas);
  }

  public async getFrameAt(time: number): Promise<ImageBitmap> {
    this.drawFrame(time);
    if (typeof createImageBitmap !== 'function') {
      throw new Error('createImageBitmap is not available in this environment.');
    }

    return createImageBitmap(this.canvas);
  }

  public resizeCanvas(cssWidth?: number, cssHeight?: number): void {
    const width = this.timeline.width;
    const height = this.timeline.height;

    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    this.canvas.style.width = typeof cssWidth === 'number'
      ? `${cssWidth}px`
      : this.mountedToContainer
        ? '100%'
        : `${width}px`;
    this.canvas.style.height = typeof cssHeight === 'number'
      ? `${cssHeight}px`
      : this.mountedToContainer
        ? '100%'
        : `${height}px`;
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.drawFrame(this.timeline.currentTime);
  }

  public destroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }

    this.audio.destroy();
    this.pool.destroy();
    this.canvas.remove();
  }

  private subscribe(): void {
    this.unsubscribers.push(
      this.timeline.on('timeupdate', (time) => {
        this.drawFrame(time);
      }),
      this.timeline.on('clip-added', () => {
        this.drawFrame(this.timeline.currentTime);
      }),
      this.timeline.on('clip-removed', () => {
        this.drawFrame(this.timeline.currentTime);
      }),
      this.timeline.on('clip-changed', () => {
        this.drawFrame(this.timeline.currentTime);
      }),
      this.timeline.on('resolution-changed', () => {
        this.resizeCanvas();
      }),
      this.timeline.on('play', () => {
        this.drawFrame(this.timeline.currentTime);
      }),
      this.timeline.on('pause', () => {
        this.drawFrame(this.timeline.currentTime);
      }),
      this.timeline.on('ended', () => {
        this.drawFrame(this.timeline.currentTime);
      }),
    );
  }
}
