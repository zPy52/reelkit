import type { Clip } from '../clips';

export type ExportFormat = 'mp4' | 'webm';
export type ExportVideoCodec = 'avc' | 'hevc' | 'vp9' | 'av1';
export type ExportAudioCodec = 'aac' | 'opus';
export type ExportQuality = 'high' | 'balanced' | 'low';
export type ExportHardwareAcceleration =
  | 'prefer-hardware'
  | 'prefer-software'
  | 'no-preference';

export interface ExportResolution {
  width?: number;
  height?: number;
}

export interface ResolvedExportResolution {
  width: number;
  height: number;
}

export interface ExportOptions {
  filename?: string;
  format?: ExportFormat;
  codec?: ExportVideoCodec;
  resolution?: ExportResolution;
  quality?: ExportQuality;
  bitrate?: number;
  fps?: number;
  hardwareAcceleration?: ExportHardwareAcceleration;
  audio?: boolean;
  audioBitrate?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  duration: number;
  stats: {
    totalFrames: number;
    encodingTimeMs: number;
    fileSizeBytes: number;
  };
}

export interface ExportPipelineResult {
  blob: Blob;
  duration: number;
  stats: ExportResult['stats'];
}

export interface ExportTimelineLike {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  getDuration(): number;
  getClips(): readonly Clip[];
}

export interface ResolvedExportOptions {
  filename: string;
  format: ExportFormat;
  codec: ExportVideoCodec;
  resolution: ResolvedExportResolution;
  quality: ExportQuality;
  bitrate: number;
  fps: number;
  hardwareAcceleration: ExportHardwareAcceleration;
  audio: boolean;
  audioBitrate: number;
  audioCodec: ExportAudioCodec;
  audioSampleRate: number;
  audioChannels: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface VideoEncoderBridgeOptions {
  width: number;
  height: number;
  fps: number;
  codec: ExportVideoCodec;
  bitrate: number;
  hardwareAcceleration: ExportHardwareAcceleration;
  onChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void;
}

export interface AudioEncoderBridgeOptions {
  sampleRate: number;
  channels: number;
  bitrate: number;
  codec: ExportAudioCodec;
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void;
}

export interface ExportMuxerOptions {
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  codec: ExportVideoCodec;
  audio: boolean;
  audioCodec: ExportAudioCodec;
  audioSampleRate: number;
  audioChannels: number;
}

export const DEFAULT_EXPORT_FORMAT: ExportFormat = 'mp4';
export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'balanced';
export const DEFAULT_EXPORT_AUDIO_BITRATE = 128_000;
export const DEFAULT_EXPORT_AUDIO_SAMPLE_RATE = 48_000;
export const DEFAULT_EXPORT_AUDIO_CHANNELS = 2;

export const DEFAULT_VIDEO_CODEC_BY_FORMAT: Record<ExportFormat, ExportVideoCodec> = {
  mp4: 'avc',
  webm: 'vp9',
};

export const DEFAULT_AUDIO_CODEC_BY_FORMAT: Record<ExportFormat, ExportAudioCodec> = {
  mp4: 'aac',
  webm: 'opus',
};

export const SUPPORTED_VIDEO_CODECS_BY_FORMAT: Record<ExportFormat, readonly ExportVideoCodec[]> = {
  mp4: ['avc', 'hevc'],
  webm: ['vp9', 'av1'],
};

export const VIDEO_CODEC_STRINGS: Record<ExportVideoCodec, string> = {
  avc: 'avc1.640028',
  hevc: 'hev1.1.6.L120.B0',
  vp9: 'vp09.00.31.08',
  av1: 'av01.0.08M.08',
};

export const AUDIO_CODEC_STRINGS: Record<ExportAudioCodec, string> = {
  aac: 'mp4a.40.2',
  opus: 'opus',
};

export const QUALITY_BITRATES_1080P: Record<ExportQuality, number> = {
  high: 8_000_000,
  balanced: 4_000_000,
  low: 1_500_000,
};
