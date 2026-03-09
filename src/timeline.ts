import { AudioClip, type Clip, EffectClip, TextClip, VideoClip } from './clips';
import type { Anchor, AudioClipOptions, BaseClipOptions } from './clips';
import { TypedEmitter } from './events/emitter';
import {
  ExportPipeline,
  ExportService,
  type ExportOptions,
  type ExportResult,
} from './export';
import { CanvasRenderer, type PreviewHandle, type PreviewOptions } from './renderer/canvas-renderer';
import { TextRenderer } from './renderer/text-renderer';

export interface PreviewFramesOptions {
  range: { start: number; end: number };
  fps?: number;
  signal?: AbortSignal;
  onFrame(time: number, frame: ImageBitmap): void;
}

export interface TimelineOptions {
  width: number;
  height: number;
  fps?: number;
}

export interface ClipPatch extends Partial<BaseClipOptions> {
  src?: string | URL;
  placement?: Record<string, unknown>;
  text?: string;
  style?: Record<string, unknown>;
  effect?: string;
  params?: Record<string, unknown>;
  audio?: boolean;
  muted?: boolean;
  volume?: number;
}

export interface TimelineEvents {
  'clip-added': [clip: Clip];
  'clip-removed': [clip: Clip];
  'clip-changed': [clip: Clip, patch: ClipPatch];
  'resolution-changed': [width: number, height: number];
  'timeupdate': [time: number];
  'play': [];
  'pause': [];
  'ended': [];
  'export-start': [];
  'export-progress': [progress: number];
  'export-complete': [result: ExportResult];
  'export-error': [error: Error];
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

type FrameHandle = number;

export class Timeline extends TypedEmitter<TimelineEvents> {
  public width: number;
  public height: number;
  public readonly fps: number;
  public get currentTime(): number {
    return this._currentTime;
  }

  public get playing(): boolean {
    return this._playing;
  }

  private readonly clips = new Map<string, Clip>();
  private readonly videoAudioCompanions = new Map<string, string>();
  private _currentTime = 0;
  private _playing = false;
  private frameHandle: FrameHandle | null = null;
  private clockOrigin = 0;
  private clockTimeAtPlay = 0;
  private offscreenRenderer?: CanvasRenderer;

  public constructor(options: TimelineOptions) {
    super();
    this.width = options.width;
    this.height = options.height;
    this.fps = options.fps ?? 30;
  }

  public add(clip: Clip): this {
    if (clip.kind === 'video' && clip.audio) {
      const renderClip = new VideoClip({
        id: clip.id,
        src: clip.src,
        start: clip.start,
        duration: clip.duration,
        in: clip.in,
        out: clip.out,
        track: clip.track,
        placement: clip.placement,
        audio: false,
        muted: clip.muted,
        volume: clip.volume,
      });
      const companion = this.createAudioCompanion(renderClip);
      this.storeClip(renderClip);
      this.storeClip(companion);
      this.videoAudioCompanions.set(renderClip.id, companion.id);
      this.emit('clip-added', renderClip);
      this.emit('clip-added', companion);
      return this;
    }

    this.storeClip(clip);
    this.emit('clip-added', clip);
    return this;
  }

  public remove(clipOrId: Clip | string): this {
    const id = typeof clipOrId === 'string' ? clipOrId : clipOrId.id;
    const clip = this.clips.get(id);
    if (!clip) {
      return this;
    }

    this.clips.delete(id);
    this.emit('clip-removed', clip);

    const companionId = this.videoAudioCompanions.get(id);
    if (companionId) {
      this.videoAudioCompanions.delete(id);
      const companion = this.clips.get(companionId);
      if (companion) {
        this.clips.delete(companionId);
        this.emit('clip-removed', companion);
      }
    }

    if (clip.kind === 'audio' && clip.linkedClipId) {
      this.videoAudioCompanions.delete(clip.linkedClipId);
    }

    return this;
  }

  public getClip(id: string): Clip | undefined {
    return this.clips.get(id);
  }

  public getClips(): readonly Clip[] {
    return Array.from(this.clips.values()).sort((left, right) => {
      if (left.track !== right.track) {
        return left.track - right.track;
      }

      if (left.start !== right.start) {
        return left.start - right.start;
      }

      return left.id.localeCompare(right.id);
    });
  }

  public updateClip(id: string, patch: ClipPatch): this {
    const clip = this.clips.get(id);
    if (!clip) {
      return this;
    }

    this.applyPatch(clip, patch);

    if (clip.kind === 'text') {
      TextRenderer.invalidate(clip);
    }

    if (clip.kind === 'video') {
      this.syncVideoCompanion(clip, patch);
    }

    this.emit('clip-changed', clip, patch);
    return this;
  }

  public getDuration(): number {
    let duration = 0;
    for (const clip of this.clips.values()) {
      duration = Math.max(duration, clip.getEnd());
    }

    return duration;
  }

  public setResolution(width: number, height: number, _options?: { anchor?: Anchor }): this {
    this.width = width;
    this.height = height;
    this.emit('resolution-changed', width, height);
    return this;
  }

  public play(startTime?: number): void {
    if (this._playing) {
      if (typeof startTime === 'number') {
        this.seek(startTime);
      }
      return;
    }

    const duration = this.getDuration();
    const nextTime = typeof startTime === 'number'
      ? this.clampTime(startTime)
      : this._currentTime >= duration && duration > 0
        ? 0
        : this._currentTime;

    this._currentTime = nextTime;
    this.clockOrigin = now();
    this.clockTimeAtPlay = nextTime;
    this._playing = true;
    this.emit('play');
    this.emit('timeupdate', this._currentTime);
    this.tick();
  }

  public pause(): void {
    if (!this._playing) {
      return;
    }

    this._playing = false;
    this.cancelFrame();
    this.emit('pause');
  }

  public seek(time: number): void {
    const nextTime = this.clampTime(time);
    this._currentTime = nextTime;

    if (this._playing) {
      this.clockOrigin = now();
      this.clockTimeAtPlay = nextTime;
    }

    this.emit('timeupdate', nextTime);
  }

  public mountPreview(container: HTMLElement, options: PreviewOptions = {}): PreviewHandle {
    const renderer = new CanvasRenderer(this, container, options);
    renderer.drawFrame(this.currentTime);
    return {
      canvas: renderer.canvas,
      destroy: () => renderer.destroy(),
      play: (startTime?: number) => this.play(startTime),
      pause: () => this.pause(),
      seek: (time: number) => this.seek(time),
    };
  }

  public async getFrameAt(time: number): Promise<ImageBitmap> {
    if (!this.offscreenRenderer) {
      this.offscreenRenderer = new CanvasRenderer(this, undefined, { pixelRatio: 1 });
    }

    return this.offscreenRenderer.getFrameAt(this.clampTime(time));
  }

  public previewFrames(options: PreviewFramesOptions): () => void {
    let cancelled = false;
    const step = 1 / (options.fps ?? this.fps);

    const onAbort = () => {
      cancelled = true;
    };

    options.signal?.addEventListener('abort', onAbort);

    void (async () => {
      for (let time = options.range.start; time <= options.range.end && !cancelled; time += step) {
        const frame = await this.getFrameAt(time);
        if (cancelled) {
          break;
        }
        options.onFrame(time, frame);
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      }
    })();

    return () => {
      cancelled = true;
      options.signal?.removeEventListener('abort', onAbort);
    };
  }

  public async export(options?: ExportOptions): Promise<ExportResult> {
    return this.runExport(options, true);
  }

  public async exportBlob(options?: ExportOptions): Promise<ExportResult> {
    return this.runExport(options, false);
  }

  public destroy(): void {
    this.pause();
    this.offscreenRenderer?.destroy();
    this.offscreenRenderer = undefined;
    this.clear();
    this.clips.clear();
    this.videoAudioCompanions.clear();
  }

  private storeClip(clip: Clip): void {
    this.clips.set(clip.id, clip);
  }

  private async runExport(
    options: ExportOptions | undefined,
    shouldDownload: boolean,
  ): Promise<ExportResult> {
    this.emit('export-start');
    this.emit('export-progress', 0);

    try {
      const resolved = ExportService.options.resolve(options, this);
      const pipeline = new ExportPipeline(this, {
        ...resolved,
        onProgress: (progress) => {
          resolved.onProgress?.(progress);
          this.emit('export-progress', progress);
        },
      });
      const pipelineResult = await pipeline.run();
      const url = shouldDownload
        ? ExportService.download.trigger(pipelineResult.blob, resolved.filename)
        : ExportService.download.createUrl(pipelineResult.blob);
      const result: ExportResult = {
        ...pipelineResult,
        url,
      };

      this.emit('export-complete', result);
      return result;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.emit('export-error', normalized);
      throw normalized;
    }
  }

  private createAudioCompanion(clip: VideoClip): AudioClip {
    return new AudioClip({
      src: clip.src,
      start: clip.start,
      duration: clip.duration,
      in: clip.in,
      out: clip.out,
      track: clip.track,
      volume: clip.volume,
      muted: clip.muted,
      mediaTag: 'video',
      linkedClipId: clip.id,
    } satisfies AudioClipOptions);
  }

  private syncVideoCompanion(clip: VideoClip, patch: ClipPatch): void {
    const companionId = this.videoAudioCompanions.get(clip.id);
    const companion = companionId ? this.clips.get(companionId) : undefined;

    if (patch.audio === false && companion) {
      this.remove(companion.id);
      return;
    }

    if (patch.audio === true && !companion) {
      const nextCompanion = this.createAudioCompanion(clip);
      this.storeClip(nextCompanion);
      this.videoAudioCompanions.set(clip.id, nextCompanion.id);
      this.emit('clip-added', nextCompanion);
      return;
    }

    if (!companion || companion.kind !== 'audio') {
      return;
    }

    companion.src = clip.src;
    companion.start = clip.start;
    companion.duration = clip.duration;
    companion.in = clip.in;
    companion.out = clip.out;
    companion.track = clip.track;
    companion.volume = clip.volume;
    companion.muted = clip.muted;
    this.emit('clip-changed', companion, patch);
  }

  private applyPatch(clip: Clip, patch: ClipPatch): void {
    if (typeof patch.start === 'number') {
      clip.start = patch.start;
    }
    if (typeof patch.duration === 'number') {
      clip.duration = patch.duration;
    }
    if ('in' in patch) {
      clip.in = patch.in;
    }
    if ('out' in patch) {
      clip.out = patch.out;
    }
    if (typeof patch.track === 'number') {
      clip.track = patch.track;
    }

    if ('src' in patch && 'src' in clip && patch.src) {
      clip.src = patch.src;
    }

    if (clip.kind === 'video') {
      if (patch.placement) {
        clip.placement = { ...clip.placement, ...patch.placement };
      }
      if (typeof patch.audio === 'boolean') {
        clip.audio = patch.audio;
      }
      if (typeof patch.muted === 'boolean') {
        clip.muted = patch.muted;
      }
      if (typeof patch.volume === 'number') {
        clip.volume = patch.volume;
      }
      return;
    }

    if (clip.kind === 'image' && patch.placement) {
      clip.placement = { ...clip.placement, ...patch.placement };
      return;
    }

    if (clip.kind === 'audio') {
      if (typeof patch.muted === 'boolean') {
        clip.muted = patch.muted;
      }
      if (typeof patch.volume === 'number') {
        clip.volume = patch.volume;
      }
      return;
    }

    if (clip.kind === 'text') {
      if (typeof patch.text === 'string') {
        clip.text = patch.text;
      }
      if (patch.placement) {
        clip.placement = { ...clip.placement, ...patch.placement };
      }
      if (patch.style) {
        clip.style = { ...clip.style, ...patch.style };
      }
      return;
    }

    if (clip.kind === 'effect') {
      if (typeof patch.effect === 'string') {
        clip.effect = patch.effect;
      }
      if (patch.params) {
        clip.params = { ...clip.params, ...patch.params };
      }
    }
  }

  private tick(): void {
    this.cancelFrame();
    this.frameHandle = this.scheduleFrame(() => {
      if (!this._playing) {
        return;
      }

      const duration = this.getDuration();
      const elapsed = (now() - this.clockOrigin) / 1000;
      const nextTime = Math.min(duration, this.clockTimeAtPlay + elapsed);
      this._currentTime = nextTime;
      this.emit('timeupdate', nextTime);

      if (nextTime >= duration) {
        this._playing = false;
        this.frameHandle = null;
        this.emit('ended');
        return;
      }

      this.tick();
    });
  }

  private scheduleFrame(callback: () => void): FrameHandle {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(() => callback());
    }

    return setTimeout(callback, 1000 / this.fps) as unknown as number;
  }

  private cancelFrame(): void {
    if (this.frameHandle === null) {
      return;
    }

    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameHandle);
    } else {
      clearTimeout(this.frameHandle);
    }

    this.frameHandle = null;
  }

  private clampTime(time: number): number {
    return Math.max(0, Math.min(time, this.getDuration()));
  }
}
