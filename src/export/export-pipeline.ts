import type { AudioClip } from '../clips';
import { ExportMuxer } from './muxer';
import { AudioEncoderBridge } from './audio-encoder-bridge';
import { FrameProducer } from './frame-producer';
import { VideoEncoderBridge } from './video-encoder-bridge';
import type {
  ExportPipelineResult,
  ExportTimelineLike,
  ResolvedExportOptions,
} from './types';

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createAbortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Export cancelled', 'AbortError');
  }

  return new Error('Export cancelled');
}

function toSourceString(source: AudioClip['src']): string {
  return source instanceof URL ? source.href : source;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export class ExportPipeline {
  public constructor(
    private readonly timeline: ExportTimelineLike,
    private readonly options: ResolvedExportOptions,
  ) {}

  public async run(): Promise<ExportPipelineResult> {
    const duration = this.timeline.getDuration();
    if (duration <= 0) {
      throw new Error('Cannot export an empty timeline.');
    }

    const startTime = now();
    const shouldEncodeAudio = this.shouldEncodeAudio();
    const totalFrames = Math.max(1, Math.ceil(duration * this.options.fps));
    const progressSteps = totalFrames + (shouldEncodeAudio ? 1 : 0);
    const frameProducer = new FrameProducer(this.timeline, {
      width: this.options.resolution.width,
      height: this.options.resolution.height,
      fps: this.options.fps,
    });
    const muxer = new ExportMuxer({
      format: this.options.format,
      width: this.options.resolution.width,
      height: this.options.resolution.height,
      fps: this.options.fps,
      codec: this.options.codec,
      audio: shouldEncodeAudio,
      audioCodec: this.options.audioCodec,
      audioSampleRate: this.options.audioSampleRate,
      audioChannels: this.options.audioChannels,
    });
    const videoEncoder = await VideoEncoderBridge.create({
      width: this.options.resolution.width,
      height: this.options.resolution.height,
      fps: this.options.fps,
      codec: this.options.codec,
      bitrate: this.options.bitrate,
      hardwareAcceleration: this.options.hardwareAcceleration,
      onChunk: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
    });
    const audioEncoder = shouldEncodeAudio
      ? await AudioEncoderBridge.create({
        sampleRate: this.options.audioSampleRate,
        channels: this.options.audioChannels,
        bitrate: this.options.audioBitrate,
        codec: this.options.audioCodec,
        onChunk: (chunk, meta) => {
          muxer.addAudioChunk(chunk, meta);
        },
      })
      : null;

    let renderedFrames = 0;

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
        this.throwIfAborted();

        const time = Math.min(duration, frameIndex / this.options.fps);
        const frame = await frameProducer.produceFrame(time);
        try {
          await videoEncoder.encode(frame, frameIndex);
        } finally {
          frame.close();
        }

        renderedFrames = frameIndex + 1;
        this.reportProgress(renderedFrames / progressSteps);

        if (frameIndex > 0 && frameIndex % 10 === 0) {
          await yieldToMain();
        }
      }

      await videoEncoder.flush();

      if (audioEncoder) {
        this.throwIfAborted();
        const audioBuffer = await this.renderAudioOffline(duration);
        this.throwIfAborted();
        await audioEncoder.encode(audioBuffer);
        await audioEncoder.flush();
        this.reportProgress((totalFrames + 1) / progressSteps);
      }

      const blob = muxer.finalize();
      this.reportProgress(1);

      return {
        blob,
        duration,
        stats: {
          totalFrames: renderedFrames,
          encodingTimeMs: now() - startTime,
          fileSizeBytes: blob.size,
        },
      };
    } finally {
      frameProducer.destroy();
      videoEncoder.close();
      audioEncoder?.close();
    }
  }

  private shouldEncodeAudio(): boolean {
    return this.options.audio && this.timeline.getClips().some((clip) => {
      return clip.kind === 'audio' && !clip.muted && clip.volume > 0;
    });
  }

  private reportProgress(progress: number): void {
    this.options.onProgress?.(clampUnit(progress));
  }

  private throwIfAborted(): void {
    if (this.options.signal?.aborted) {
      throw createAbortError();
    }
  }

  private async renderAudioOffline(duration: number): Promise<AudioBuffer> {
    if (typeof OfflineAudioContext === 'undefined') {
      throw new Error('OfflineAudioContext is not available in this environment.');
    }

    const totalFrames = Math.max(1, Math.ceil(duration * this.options.audioSampleRate));
    const offline = new OfflineAudioContext(
      this.options.audioChannels,
      totalFrames,
      this.options.audioSampleRate,
    );
    const audioClips = this.timeline.getClips().filter((clip): clip is AudioClip => {
      return clip.kind === 'audio' && !clip.muted && clip.volume > 0;
    });
    const decodedCache = new Map<string, AudioBuffer>();

    for (const clip of audioClips) {
      this.throwIfAborted();

      const sourceKey = toSourceString(clip.src);
      let decoded = decodedCache.get(sourceKey);
      if (!decoded) {
        const response = await fetch(sourceKey);
        if (!response.ok) {
          throw new Error(`Unable to fetch audio source "${sourceKey}" for export.`);
        }

        const bytes = await response.arrayBuffer();
        decoded = await offline.decodeAudioData(bytes);
        decodedCache.set(sourceKey, decoded);
      }

      const source = offline.createBufferSource();
      source.buffer = decoded;

      const gain = offline.createGain();
      gain.gain.value = clampUnit(clip.volume);
      source.connect(gain).connect(offline.destination);

      const offset = Math.max(0, clip.in ?? 0);
      const sourceEnd = typeof clip.out === 'number'
        ? Math.min(decoded.duration, Math.max(offset, clip.out))
        : decoded.duration;
      const clipDuration = Math.max(0, Math.min(clip.duration, sourceEnd - offset));
      if (clipDuration <= 0) {
        continue;
      }

      source.start(clip.start, offset, clipDuration);
    }

    return offline.startRendering();
  }
}
