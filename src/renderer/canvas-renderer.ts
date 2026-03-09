import type { AudioClip, Clip, EffectClip } from '../clips';
import { AudioEngine } from '../audio/audio-engine';
import { Compositor } from './compositor';
import { getFrameState, resolveRenderTime } from './frame-state';
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
  private readonly trackCanvas: HTMLCanvasElement;
  private readonly trackContext: CanvasRenderingContext2D;

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
    this.trackCanvas = document.createElement('canvas');
    this.trackContext = this.trackCanvas.getContext('2d');
    if (!this.trackContext) {
      throw new Error('Unable to acquire a 2D context for track compositing.');
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
    const renderTime = resolveRenderTime(time, this.timeline.getDuration());
    const frameState = getFrameState(this.timeline.getClips(), renderTime);

    this.context.clearRect(0, 0, canvasSize.width, canvasSize.height);

    this.audio.sync(frameState.audioClips, renderTime, this.timeline.playing);
    this.pool.pauseInactiveClips(frameState.activeClips);

    for (const layer of frameState.trackLayers) {
      this.trackContext.clearRect(0, 0, canvasSize.width, canvasSize.height);
      for (const clip of layer.clips) {
        this.compositor.draw(this.trackContext, clip, renderTime, canvasSize, this.timeline.playing);
      }

      this.compositor.applyEffects(this.trackContext, layer.effects, renderTime, this.trackCanvas, {
        ...canvasSize,
        pixelRatio: this.pixelRatio,
      });

      if (layer.clips.length > 0 || layer.effects.length > 0) {
        this.compositor.compositeSurface(this.context, this.trackCanvas, canvasSize);
      }
    }

    this.compositor.applyEffects(this.context, frameState.compositionEffects, renderTime, this.canvas, {
      ...canvasSize,
      pixelRatio: this.pixelRatio,
    });
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
    this.trackCanvas.width = this.canvas.width;
    this.trackCanvas.height = this.canvas.height;
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
    this.trackContext.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
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
