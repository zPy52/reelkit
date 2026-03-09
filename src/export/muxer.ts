import { ArrayBufferTarget as Mp4ArrayBufferTarget, Muxer as Mp4Muxer } from 'mp4-muxer';
import { ArrayBufferTarget as WebmArrayBufferTarget, Muxer as WebmMuxer } from 'webm-muxer';
import type { ExportMuxerOptions } from './types';

type Mp4Target = InstanceType<typeof Mp4ArrayBufferTarget>;
type WebmTarget = InstanceType<typeof WebmArrayBufferTarget>;
type Mp4MuxerInstance = Mp4Muxer<Mp4Target>;
type WebmMuxerInstance = WebmMuxer<WebmTarget>;

function toWebmVideoCodec(codec: ExportMuxerOptions['codec']): 'V_VP9' | 'V_AV1' {
  return codec === 'av1' ? 'V_AV1' : 'V_VP9';
}

function toWebmAudioCodec(): 'A_OPUS' {
  return 'A_OPUS';
}

export class ExportMuxer {
  private readonly muxer: Mp4MuxerInstance | WebmMuxerInstance;
  private readonly target: Mp4Target | WebmTarget;

  public constructor(private readonly options: ExportMuxerOptions) {
    if (options.format === 'mp4') {
      this.target = new Mp4ArrayBufferTarget();
      this.muxer = new Mp4Muxer({
        target: this.target,
        video: {
          codec: options.codec === 'hevc' ? 'hevc' : 'avc',
          width: options.width,
          height: options.height,
          frameRate: options.fps,
        },
        audio: options.audio
          ? {
            codec: options.audioCodec,
            sampleRate: options.audioSampleRate,
            numberOfChannels: options.audioChannels,
          }
          : undefined,
        fastStart: false,
        firstTimestampBehavior: 'offset',
      });
      return;
    }

    this.target = new WebmArrayBufferTarget();
    this.muxer = new WebmMuxer({
      target: this.target,
      video: {
        codec: toWebmVideoCodec(options.codec),
        width: options.width,
        height: options.height,
        frameRate: options.fps,
      },
      audio: options.audio
        ? {
          codec: toWebmAudioCodec(),
          sampleRate: options.audioSampleRate,
          numberOfChannels: options.audioChannels,
        }
        : undefined,
      firstTimestampBehavior: 'offset',
    });
  }

  public addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void {
    this.muxer.addVideoChunk(chunk, meta);
  }

  public addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void {
    this.muxer.addAudioChunk(chunk, meta);
  }

  public finalize(): Blob {
    this.muxer.finalize();

    const buffer = this.target.buffer;
    return new Blob(
      [buffer],
      { type: this.options.format === 'mp4' ? 'video/mp4' : 'video/webm' },
    );
  }
}
