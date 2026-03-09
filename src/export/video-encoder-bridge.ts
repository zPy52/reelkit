import { VIDEO_CODEC_STRINGS } from './types';
import type { VideoEncoderBridgeOptions } from './types';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function createConfig(options: VideoEncoderBridgeOptions): VideoEncoderConfig {
  const config: VideoEncoderConfig = {
    codec: VIDEO_CODEC_STRINGS[options.codec],
    width: options.width,
    height: options.height,
    bitrate: options.bitrate,
    framerate: options.fps,
    hardwareAcceleration: options.hardwareAcceleration,
    latencyMode: 'quality',
  };

  if (options.codec === 'avc') {
    config.avc = { format: 'avc' };
  }

  return config;
}

function waitForDequeue(encoder: VideoEncoder): Promise<void> {
  return new Promise((resolve) => {
    encoder.addEventListener('dequeue', () => resolve(), { once: true });
  });
}

export class VideoEncoderBridge {
  private readonly encoder: VideoEncoder;
  private readonly keyframeInterval: number;
  private error: Error | null = null;

  private constructor(
    private readonly options: VideoEncoderBridgeOptions,
    config: VideoEncoderConfig,
  ) {
    this.keyframeInterval = Math.max(1, Math.round(options.fps * 2));
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        this.options.onChunk(chunk, meta);
      },
      error: (error) => {
        this.error = normalizeError(error);
      },
    });
    this.encoder.configure(config);
  }

  public static async create(options: VideoEncoderBridgeOptions): Promise<VideoEncoderBridge> {
    if (typeof VideoEncoder === 'undefined') {
      throw new Error('WebCodecs VideoEncoder is not available in this environment.');
    }

    const config = createConfig(options);
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported || !support.config) {
      throw new Error(
        `Video codec "${options.codec}" is not supported at ${options.width}x${options.height} ${options.fps}fps.`,
      );
    }

    return new VideoEncoderBridge(options, support.config);
  }

  public async encode(frame: VideoFrame, frameIndex: number): Promise<void> {
    this.throwIfErrored();

    this.encoder.encode(frame, {
      keyFrame: frameIndex % this.keyframeInterval === 0,
    });

    if (this.encoder.encodeQueueSize > 5) {
      await waitForDequeue(this.encoder);
    }

    this.throwIfErrored();
  }

  public async flush(): Promise<void> {
    this.throwIfErrored();
    await this.encoder.flush();
    this.throwIfErrored();
    this.close();
  }

  public close(): void {
    if (this.encoder.state !== 'closed') {
      this.encoder.close();
    }
  }

  private throwIfErrored(): void {
    if (this.error) {
      throw this.error;
    }
  }
}
