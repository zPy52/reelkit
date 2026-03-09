import { AUDIO_CODEC_STRINGS } from './types';
import type { AudioEncoderBridgeOptions } from './types';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function createConfig(options: AudioEncoderBridgeOptions): AudioEncoderConfig {
  return {
    codec: AUDIO_CODEC_STRINGS[options.codec],
    sampleRate: options.sampleRate,
    numberOfChannels: options.channels,
    bitrate: options.bitrate,
  };
}

function waitForDequeue(encoder: AudioEncoder): Promise<void> {
  return new Promise((resolve) => {
    encoder.addEventListener('dequeue', () => resolve(), { once: true });
  });
}

export class AudioEncoderBridge {
  private readonly encoder: AudioEncoder;
  private error: Error | null = null;

  private constructor(
    private readonly options: AudioEncoderBridgeOptions,
    config: AudioEncoderConfig,
  ) {
    this.encoder = new AudioEncoder({
      output: (chunk, meta) => {
        this.options.onChunk(chunk, meta);
      },
      error: (error) => {
        this.error = normalizeError(error);
      },
    });
    this.encoder.configure(config);
  }

  public static async create(options: AudioEncoderBridgeOptions): Promise<AudioEncoderBridge> {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
      throw new Error('WebCodecs AudioEncoder is not available in this environment.');
    }

    const config = createConfig(options);
    const support = await AudioEncoder.isConfigSupported(config);
    if (!support.supported || !support.config) {
      throw new Error(
        `Audio codec "${options.codec}" is not supported at ${options.sampleRate}Hz.`,
      );
    }

    return new AudioEncoderBridge(options, support.config);
  }

  public async encode(buffer: AudioBuffer): Promise<void> {
    this.throwIfErrored();

    const chunkSize = 1024;
    const channels = buffer.numberOfChannels;
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      const frameCount = Math.min(chunkSize, buffer.length - offset);
      const planar = new Float32Array(frameCount * channels);

      for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
        const channelData = buffer.getChannelData(channelIndex).subarray(offset, offset + frameCount);
        planar.set(channelData, channelIndex * frameCount);
      }

      const audioData = new AudioData({
        data: planar,
        format: 'f32-planar',
        sampleRate: buffer.sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels: channels,
        timestamp: Math.round((offset / buffer.sampleRate) * 1_000_000),
      });

      this.encoder.encode(audioData);
      audioData.close();

      if (this.encoder.encodeQueueSize > 10) {
        await waitForDequeue(this.encoder);
      }

      this.throwIfErrored();
    }
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
