import type { Clip, EffectClip, ImageClip, VideoClip } from '../clips';
import { Compositor } from '../renderer/compositor';
import { getFrameState, resolveRenderTime } from '../renderer/frame-state';
import { MediaPool } from '../renderer/media-pool';
import type { ExportTimelineLike } from './types';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class FrameProducer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly compositor: Compositor;
  private readonly pool: MediaPool;
  private readonly frameDuration: number;
  private readonly trackCanvas: HTMLCanvasElement;
  private readonly trackContext: CanvasRenderingContext2D;

  public constructor(
    private readonly timeline: ExportTimelineLike,
    output: { width: number; height: number; fps: number },
  ) {
    if (typeof document === 'undefined') {
      throw new Error('Frame export requires a DOM-enabled environment.');
    }
    if (typeof VideoFrame === 'undefined') {
      throw new Error('WebCodecs VideoFrame is not available in this environment.');
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = output.width;
    this.canvas.height = output.height;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to acquire a 2D context for export rendering.');
    }

    this.trackCanvas = document.createElement('canvas');
    this.trackCanvas.width = output.width;
    this.trackCanvas.height = output.height;
    const trackContext = this.trackCanvas.getContext('2d');
    if (!trackContext) {
      throw new Error('Unable to acquire a 2D context for export track compositing.');
    }

    this.context = context;
    this.trackContext = trackContext;
    this.pool = new MediaPool();
    this.compositor = new Compositor(this.pool);
    this.frameDuration = Math.round(1_000_000 / output.fps);
  }

  public async produceFrame(time: number): Promise<VideoFrame> {
    const canvasSize = { width: this.canvas.width, height: this.canvas.height };
    const renderTime = resolveRenderTime(time, this.timeline.getDuration());
    const frameState = getFrameState(this.timeline.getClips(), renderTime);

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const layer of frameState.trackLayers) {
      this.trackContext.clearRect(0, 0, this.trackCanvas.width, this.trackCanvas.height);

      for (const clip of layer.clips) {
        await this.prepareClip(clip, renderTime);
        this.compositor.draw(this.trackContext, clip, renderTime, canvasSize, false);
      }

      this.compositor.applyEffects(this.trackContext, layer.effects, renderTime, this.trackCanvas, {
        ...canvasSize,
        pixelRatio: 1,
      });

      if (layer.clips.length > 0 || layer.effects.length > 0) {
        this.compositor.compositeSurface(this.context, this.trackCanvas, canvasSize);
      }
    }

    this.compositor.applyEffects(this.context, frameState.compositionEffects, renderTime, this.canvas, {
      ...canvasSize,
      pixelRatio: 1,
    });

    return new VideoFrame(this.canvas, {
      timestamp: Math.round(time * 1_000_000),
      duration: this.frameDuration,
    });
  }

  public destroy(): void {
    this.pool.destroy();
  }

  private async prepareClip(
    clip: Exclude<Clip, { kind: 'audio' | 'effect' }>,
    time: number,
  ): Promise<void> {
    if (clip.kind === 'video') {
      await this.prepareVideo(clip, time);
      return;
    }

    if (clip.kind === 'image') {
      await this.prepareImage(clip);
    }
  }

  private async prepareImage(clip: ImageClip): Promise<void> {
    const element = this.pool.getImageElement(clip.src);
    if (element.complete) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`Unable to load image source "${String(clip.src)}" for export.`));
      };
      const cleanup = () => {
        element.removeEventListener('load', onLoad);
        element.removeEventListener('error', onError);
      };

      element.addEventListener('load', onLoad, { once: true });
      element.addEventListener('error', onError, { once: true });
    });
  }

  private async prepareVideo(clip: VideoClip, time: number): Promise<void> {
    const element = this.pool.getVideoElement(clip);
    await this.waitForVideoReady(element, clip);

    const sourceStart = Math.max(0, clip.in ?? 0);
    const availableEnd = typeof clip.out === 'number'
      ? Math.max(sourceStart, clip.out)
      : Number.isFinite(element.duration) && element.duration > 0
        ? element.duration
        : undefined;
    const localTime = Math.max(sourceStart, time - clip.start + sourceStart);
    const desiredTime = this.clampMediaTime(
      typeof availableEnd === 'number' ? Math.min(localTime, availableEnd) : localTime,
      element.duration,
    );

    if (Math.abs((element.currentTime || 0) - desiredTime) <= 0.001) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`Unable to seek video source "${String(clip.src)}" for export.`));
      };
      const cleanup = () => {
        element.removeEventListener('seeked', onSeeked);
        element.removeEventListener('error', onError);
      };

      element.addEventListener('seeked', onSeeked, { once: true });
      element.addEventListener('error', onError, { once: true });
      try {
        element.currentTime = desiredTime;
      } catch (error) {
        cleanup();
        reject(normalizeError(error));
      }
    });
  }

  private async waitForVideoReady(element: HTMLVideoElement, clip: VideoClip): Promise<void> {
    if (element.readyState >= 2) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`Unable to load video source "${String(clip.src)}" for export.`));
      };
      const cleanup = () => {
        element.removeEventListener('loadeddata', onReady);
        element.removeEventListener('canplay', onReady);
        element.removeEventListener('error', onError);
      };

      element.addEventListener('loadeddata', onReady, { once: true });
      element.addEventListener('canplay', onReady, { once: true });
      element.addEventListener('error', onError, { once: true });
    });
  }

  private clampMediaTime(time: number, duration: number): number {
    if (!Number.isFinite(duration) || duration <= 0) {
      return Math.max(0, time);
    }

    return Math.max(0, Math.min(time, Math.max(0, duration - 0.001)));
  }
}
