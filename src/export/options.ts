import { SubmoduleExportServiceResolution } from './resolution';
import {
  DEFAULT_AUDIO_CODEC_BY_FORMAT,
  DEFAULT_EXPORT_AUDIO_BITRATE,
  DEFAULT_EXPORT_AUDIO_CHANNELS,
  DEFAULT_EXPORT_AUDIO_SAMPLE_RATE,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_EXPORT_QUALITY,
  DEFAULT_VIDEO_CODEC_BY_FORMAT,
  SUPPORTED_VIDEO_CODECS_BY_FORMAT,
} from './types';
import type {
  ExportOptions,
  ExportTimelineLike,
  ExportVideoCodec,
  ResolvedExportOptions,
} from './types';

const resolution = new SubmoduleExportServiceResolution();

export class SubmoduleExportServiceOptions {
  public resolve(
    options: ExportOptions | undefined,
    timeline: ExportTimelineLike,
  ): ResolvedExportOptions {
    const format = options?.format ?? DEFAULT_EXPORT_FORMAT;
    const codec = options?.codec ?? DEFAULT_VIDEO_CODEC_BY_FORMAT[format];
    this.assertCodec(format, codec);

    const quality = options?.quality ?? DEFAULT_EXPORT_QUALITY;
    const resolvedResolution = resolution.resolve(
      options?.resolution,
      timeline.width,
      timeline.height,
    );

    const fps = options?.fps ?? timeline.fps;
    const bitrate = options?.bitrate ?? resolution.bitrate(
      quality,
      resolvedResolution.width,
      resolvedResolution.height,
    );
    const audioBitrate = options?.audioBitrate ?? DEFAULT_EXPORT_AUDIO_BITRATE;

    this.assertPositive('fps', fps);
    this.assertPositive('bitrate', bitrate);
    this.assertPositive('audioBitrate', audioBitrate);

    return {
      filename: this.resolveFilename(options?.filename, format),
      format,
      codec,
      resolution: resolvedResolution,
      quality,
      bitrate: Math.round(bitrate),
      fps,
      hardwareAcceleration: options?.hardwareAcceleration ?? 'no-preference',
      audio: options?.audio ?? true,
      audioBitrate: Math.round(audioBitrate),
      audioCodec: DEFAULT_AUDIO_CODEC_BY_FORMAT[format],
      audioSampleRate: DEFAULT_EXPORT_AUDIO_SAMPLE_RATE,
      audioChannels: DEFAULT_EXPORT_AUDIO_CHANNELS,
      signal: options?.signal,
      onProgress: options?.onProgress,
    };
  }

  private resolveFilename(filename: string | undefined, format: ResolvedExportOptions['format']): string {
    const trimmed = filename?.trim();
    return trimmed ? trimmed : `composition.${format}`;
  }

  private assertCodec(
    format: ResolvedExportOptions['format'],
    codec: ExportVideoCodec,
  ): void {
    if (!SUPPORTED_VIDEO_CODECS_BY_FORMAT[format].includes(codec)) {
      throw new Error(`Codec "${codec}" is not supported for the "${format}" format.`);
    }
  }

  private assertPositive(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a positive number.`);
    }
  }
}
