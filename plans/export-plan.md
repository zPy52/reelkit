# Browser Export Plan
## Canvas → Encoded Video → Download

**Date:** 2026-03-09
**Scope:** Add `timeline.export()` that renders the composition to an encoded video file and triggers a browser download.

---

## 1. Context

The current SDK renders compositions to `<canvas>` in real-time for preview. There is no way to produce an actual video file. The goal is:

```ts
await timeline.export({
  format: 'mp4',
  resolution: { width: 1920 },   // height inferred from aspect ratio
  quality: 'high',
});
// → browser downloads "composition.mp4"
```

### Why browser-only (no FFmpeg server)

The SDK is browser-first. The `ffmpeg-static` dependency in `package.json` is unused by the current `src/`. Export should work entirely client-side using **WebCodecs API** (VideoEncoder + AudioEncoder) for encoding and lightweight muxer libraries for container packaging. This gives:

- Zero server dependency
- Hardware-accelerated encoding (GPU where available, transparent to the user)
- Sub-second latency to start encoding (no FFmpeg spawn)

### Hardware acceleration

Unlike the `hw.md` plan (which enumerated FFmpeg encoder IDs), WebCodecs delegates hardware selection to the browser. The browser automatically uses GPU encoding (e.g. NVENC, VideoToolbox, VAAPI) when available. The user does not need to pick an encoder — they pick a **codec** (`h264`, `vp9`, `av1`) and the browser routes to the best available hardware. We expose an optional `hardwareAcceleration` preference (`'prefer-hardware' | 'prefer-software' | 'no-preference'`) that maps directly to the WebCodecs `VideoEncoderConfig.hardwareAcceleration` field.

---

## 2. Public API

### 2.1 `timeline.export(options?)`

```ts
interface ExportOptions {
  /** Output filename (default: 'composition.mp4') */
  filename?: string;

  /** Container format (default: 'mp4') */
  format?: 'mp4' | 'webm';

  /** Video codec (default: format-dependent — 'avc' for mp4, 'vp9' for webm) */
  codec?: 'avc' | 'hevc' | 'vp9' | 'av1';

  /**
   * Output resolution. Omit to use timeline resolution.
   * If only width or height is specified, the other is computed to preserve aspect ratio.
   */
  resolution?: {
    width?: number;
    height?: number;
  };

  /**
   * Quality preset. Controls bitrate.
   * - 'high':     8 Mbps @ 1080p (scaled by resolution)
   * - 'balanced': 4 Mbps @ 1080p
   * - 'low':      1.5 Mbps @ 1080p
   * Default: 'balanced'
   */
  quality?: 'high' | 'balanced' | 'low';

  /** Override bitrate directly in bits/sec (takes precedence over quality preset) */
  bitrate?: number;

  /** Frames per second for the output (default: timeline.fps) */
  fps?: number;

  /**
   * Hardware acceleration preference (default: 'no-preference').
   * Maps to WebCodecs VideoEncoderConfig.hardwareAcceleration.
   */
  hardwareAcceleration?: 'prefer-hardware' | 'prefer-software' | 'no-preference';

  /** Include audio in the export (default: true) */
  audio?: boolean;

  /** Audio bitrate in bits/sec (default: 128000) */
  audioBitrate?: number;

  /** AbortSignal to cancel the export */
  signal?: AbortSignal;

  /** Progress callback: 0–1 */
  onProgress?: (progress: number) => void;
}

interface ExportResult {
  /** The Blob of the encoded file */
  blob: Blob;
  /** The URL created for the download (caller can revoke if needed) */
  url: string;
  /** Duration of the exported video in seconds */
  duration: number;
  /** Encoding stats */
  stats: {
    totalFrames: number;
    encodingTimeMs: number;
    fileSizeBytes: number;
  };
}
```

Usage:

```ts
// Simplest — downloads composition.mp4 at timeline resolution, balanced quality
await timeline.export();

// Custom resolution (preserves aspect ratio), high quality, with progress
await timeline.export({
  filename: 'my-video.mp4',
  resolution: { width: 1920 },
  quality: 'high',
  onProgress: (p) => progressBar.value = p,
});

// WebM/VP9, low quality for quick share
await timeline.export({
  format: 'webm',
  codec: 'vp9',
  quality: 'low',
});

// Cancel support
const controller = new AbortController();
cancelBtn.onclick = () => controller.abort();
await timeline.export({ signal: controller.signal });
```

### 2.2 `timeline.exportBlob(options?)`

Same as `export()` but returns the `ExportResult` without triggering a download. Useful when the caller wants to upload the blob, display it in a `<video>`, etc.

```ts
const result = await timeline.exportBlob({
  format: 'mp4',
  quality: 'high',
});
// result.blob — the file
// result.url — object URL (caller should revoke when done)
```

### 2.3 Events

```ts
type TimelineEvents = {
  // ... existing events ...
  'export-start': [];
  'export-progress': [progress: number];
  'export-complete': [result: ExportResult];
  'export-error': [error: Error];
};
```

### 2.4 React hook: `useExport`

```ts
interface UseExportResult {
  /** Start an export. Resolves when done. */
  exportVideo: (options?: ExportOptions) => Promise<ExportResult>;
  /** Cancel a running export */
  cancel: () => void;
  /** Current progress 0–1, or null if not exporting */
  progress: number | null;
  /** Whether an export is in progress */
  isExporting: boolean;
  /** Error from last failed export, or null */
  error: Error | null;
}

function useExport(timeline: Timeline): UseExportResult;
```

Usage:

```tsx
function ExportButton() {
  const timeline = useTimeline({ width: 1280, height: 720 });
  const { exportVideo, cancel, progress, isExporting } = useExport(timeline);

  return (
    <div>
      <button
        onClick={() => exportVideo({ quality: 'high', resolution: { width: 1920 } })}
        disabled={isExporting}
      >
        Export
      </button>
      {isExporting && (
        <>
          <progress value={progress ?? 0} max={1} />
          <button onClick={cancel}>Cancel</button>
        </>
      )}
    </div>
  );
}
```

---

## 3. File Structure

```
src/
├── export/
│   ├── index.ts                  # Re-exports ExportPipeline, types
│   ├── export-pipeline.ts        # ExportPipeline: orchestrates frame render → encode → mux → download
│   ├── frame-producer.ts         # FrameProducer: drives CanvasRenderer at export fps, yields VideoFrames
│   ├── video-encoder-bridge.ts   # VideoEncoderBridge: wraps WebCodecs VideoEncoder
│   ├── audio-encoder-bridge.ts   # AudioEncoderBridge: wraps WebCodecs AudioEncoder + OfflineAudioContext
│   ├── muxer.ts                  # Muxer: wraps mp4-muxer / webm-muxer libraries
│   ├── download.ts               # triggerDownload(): create blob URL, click <a>, revoke
│   ├── resolution.ts             # resolveExportResolution(): aspect-ratio math
│   └── types.ts                  # ExportOptions, ExportResult, QualityPreset, codec maps
│
├── react/
│   ├── hooks/
│   │   ├── export.ts             # SubmodulePreviewHooksExport (useExport)
│   │   └── ... (existing)
│   └── ... (existing)
│
└── ... (existing files unchanged)
```

### Dependencies to add

```json
{
  "dependencies": {
    "mp4-muxer": "^5.1.3",
    "webm-muxer": "^5.0.2"
  }
}
```

These are small, browser-compatible muxer libraries (by Vani Wasabi). They accept encoded `EncodedVideoChunk` / `EncodedAudioChunk` from WebCodecs and produce MP4/WebM containers. No WASM, no FFmpeg.

---

## 4. Internal Architecture

### 4.1 Export Pipeline (`src/export/export-pipeline.ts`)

The pipeline coordinates the export process:

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐     ┌──────────┐
│ FrameProducer│────▶│VideoEncoderBridge│────▶│     Muxer      │────▶│ Download │
│ (canvas draw)│     │ (WebCodecs)      │     │ (mp4/webm-mux) │     │ (blob)   │
└──────────────┘     └──────────────────┘     └────────────────┘     └──────────┘
                                                       ▲
                     ┌──────────────────┐              │
                     │AudioEncoderBridge│──────────────┘
                     │(OfflineAudioCtx) │
                     └──────────────────┘
```

```ts
class ExportPipeline {
  constructor(
    private timeline: TimelineLike,
    private options: ResolvedExportOptions,
  ) {}

  async run(): Promise<ExportResult> {
    const startTime = performance.now();

    // 1. Resolve output resolution
    const { width, height } = resolveExportResolution(
      this.options.resolution,
      this.timeline.width,
      this.timeline.height,
    );

    // 2. Create muxer (mp4 or webm)
    const muxer = new Muxer(this.options.format, {
      width, height,
      fps: this.options.fps,
      codec: this.options.codec,
      videoBitrate: this.options.bitrate,
      audioBitrate: this.options.audioBitrate,
    });

    // 3. Create video encoder
    const videoEncoder = new VideoEncoderBridge({
      width, height,
      fps: this.options.fps,
      codec: this.options.codec,
      bitrate: this.options.bitrate,
      hardwareAcceleration: this.options.hardwareAcceleration,
      onChunk: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    });

    // 4. Create audio encoder (if audio enabled)
    let audioEncoder: AudioEncoderBridge | null = null;
    if (this.options.audio) {
      audioEncoder = new AudioEncoderBridge({
        sampleRate: 48000,
        channels: 2,
        bitrate: this.options.audioBitrate,
        codec: this.options.audioCodec,
        onChunk: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      });
    }

    // 5. Create frame producer (offscreen canvas renderer)
    const frameProducer = new FrameProducer(this.timeline, { width, height });

    // 6. Render and encode each frame
    const duration = this.timeline.getDuration();
    const totalFrames = Math.ceil(duration * this.options.fps);
    let frameIndex = 0;

    for (let i = 0; i < totalFrames; i++) {
      if (this.options.signal?.aborted) {
        throw new DOMException('Export cancelled', 'AbortError');
      }

      const time = i / this.options.fps;
      const videoFrame = await frameProducer.produceFrame(time);
      await videoEncoder.encode(videoFrame, i);
      videoFrame.close();

      frameIndex++;
      this.options.onProgress?.(frameIndex / totalFrames);

      // Yield to event loop periodically to keep UI responsive
      if (i % 10 === 0) await yieldToMain();
    }

    // 7. Encode audio (batch — render entire audio offline, then encode)
    if (audioEncoder) {
      const audioBuffer = await this.renderAudioOffline(duration);
      await audioEncoder.encode(audioBuffer);
    }

    // 8. Flush and finalize
    await videoEncoder.flush();
    await audioEncoder?.flush();
    const blob = muxer.finalize();

    const url = URL.createObjectURL(blob);

    return {
      blob,
      url,
      duration,
      stats: {
        totalFrames: frameIndex,
        encodingTimeMs: performance.now() - startTime,
        fileSizeBytes: blob.size,
      },
    };
  }

  /**
   * Render all audio clips to a single AudioBuffer using OfflineAudioContext.
   * This decodes each audio source, places it at the correct timeline offset,
   * and mixes down to stereo.
   */
  private async renderAudioOffline(duration: number): Promise<AudioBuffer> {
    const sampleRate = 48000;
    const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

    const audioClips = this.timeline.getClips().filter(
      (c): c is AudioClip => c.kind === 'audio'
    );

    for (const clip of audioClips) {
      const response = await fetch(clip.src as string);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await offline.decodeAudioData(arrayBuffer);

      const source = offline.createBufferSource();
      source.buffer = decoded;

      // Apply volume
      const gain = offline.createGain();
      gain.gain.value = clip.muted ? 0 : clip.volume;
      source.connect(gain).connect(offline.destination);

      // Schedule: start at clip.start on the timeline, offset by clip.in
      const offset = clip.in ?? 0;
      const clipDuration = clip.duration;
      source.start(clip.start, offset, clipDuration);
    }

    return offline.startRendering();
  }
}

function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
```

### 4.2 FrameProducer (`src/export/frame-producer.ts`)

Renders individual frames at specified times using an offscreen canvas:

```ts
class FrameProducer {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private compositor: Compositor;
  private pool: MediaPool;

  constructor(timeline: TimelineLike, output: { width: number; height: number }) {
    this.canvas = new OffscreenCanvas(output.width, output.height);
    this.ctx = this.canvas.getContext('2d')!;
    // Re-use the existing Compositor and MediaPool from the renderer module
    this.pool = new MediaPool();
    this.compositor = new Compositor(this.pool);
  }

  async produceFrame(time: number): Promise<VideoFrame> {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // Get active clips at this time (same logic as CanvasRenderer.drawFrame)
    const active = this.getActiveClips(time);
    for (const clip of active) {
      if (clip.kind === 'audio') continue;
      // Ensure media is seeked to the right time before drawing
      if (clip.kind === 'video') {
        await this.seekVideoTo(clip, time);
      }
      this.compositor.draw(this.ctx, clip, time, { width, height }, false);
    }

    // Create VideoFrame from the canvas
    return new VideoFrame(this.canvas, {
      timestamp: time * 1_000_000, // microseconds
    });
  }

  /**
   * Seek video element and wait for the frame to be ready.
   * This is critical for frame-accurate export (unlike preview which tolerates drift).
   */
  private async seekVideoTo(clip: VideoClip, time: number): Promise<void> {
    const local = time - clip.start + (clip.in ?? 0);
    const el = this.pool.getVideoElement(clip.src as string);
    if (Math.abs(el.currentTime - local) < 0.001) return;
    el.currentTime = local;
    await new Promise<void>(resolve => {
      el.addEventListener('seeked', () => resolve(), { once: true });
    });
  }

  destroy(): void {
    this.pool.destroy();
  }
}
```

### 4.3 VideoEncoderBridge (`src/export/video-encoder-bridge.ts`)

Wraps WebCodecs `VideoEncoder`:

```ts
interface VideoEncoderBridgeOptions {
  width: number;
  height: number;
  fps: number;
  codec: 'avc' | 'hevc' | 'vp9' | 'av1';
  bitrate: number;
  hardwareAcceleration: 'prefer-hardware' | 'prefer-software' | 'no-preference';
  onChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void;
}

class VideoEncoderBridge {
  private encoder: VideoEncoder;
  private frameIndex: number = 0;
  private keyframeInterval: number;

  constructor(private options: VideoEncoderBridgeOptions) {
    this.keyframeInterval = options.fps * 2; // keyframe every 2 seconds

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => options.onChunk(chunk, meta),
      error: (e) => { throw e; },
    });

    this.encoder.configure({
      codec: CODEC_STRINGS[options.codec],   // e.g. 'avc1.640028'
      width: options.width,
      height: options.height,
      bitrate: options.bitrate,
      framerate: options.fps,
      hardwareAcceleration: options.hardwareAcceleration,
      latencyMode: 'quality',
    });
  }

  async encode(frame: VideoFrame, frameIndex: number): Promise<void> {
    const keyFrame = frameIndex % this.keyframeInterval === 0;
    this.encoder.encode(frame, { keyFrame });
    // Back-pressure: wait if encoder queue is building up
    if (this.encoder.encodeQueueSize > 5) {
      await new Promise<void>(resolve => {
        this.encoder.addEventListener('dequeue', () => resolve(), { once: true });
      });
    }
  }

  async flush(): Promise<void> {
    await this.encoder.flush();
    this.encoder.close();
  }
}

/**
 * WebCodecs codec strings.
 * AVC/H.264: High profile, level 4.0 (suitable up to 1080p30 / 720p60).
 * Level is adjusted at configure time based on resolution if needed.
 */
const CODEC_STRINGS: Record<string, string> = {
  avc:  'avc1.640028',
  hevc: 'hev1.1.6.L120.B0',
  vp9:  'vp09.00.31.08',
  av1:  'av01.0.08M.08',
};
```

### 4.4 AudioEncoderBridge (`src/export/audio-encoder-bridge.ts`)

Wraps WebCodecs `AudioEncoder`:

```ts
interface AudioEncoderBridgeOptions {
  sampleRate: number;
  channels: number;
  bitrate: number;
  codec: 'aac' | 'opus';
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void;
}

class AudioEncoderBridge {
  private encoder: AudioEncoder;

  constructor(private options: AudioEncoderBridgeOptions) {
    this.encoder = new AudioEncoder({
      output: (chunk, meta) => options.onChunk(chunk, meta),
      error: (e) => { throw e; },
    });

    this.encoder.configure({
      codec: options.codec === 'aac' ? 'mp4a.40.2' : 'opus',
      sampleRate: options.sampleRate,
      numberOfChannels: options.channels,
      bitrate: options.bitrate,
    });
  }

  async encode(buffer: AudioBuffer): Promise<void> {
    // Convert AudioBuffer → AudioData chunks and feed to encoder
    const chunkSize = 1024; // samples per chunk
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;

    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      const length = Math.min(chunkSize, buffer.length - offset);

      // Interleave channels into Float32Array
      const interleaved = new Float32Array(length * channels);
      for (let ch = 0; ch < channels; ch++) {
        const channelData = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          interleaved[i * channels + ch] = channelData[offset + i];
        }
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: length,
        numberOfChannels: channels,
        timestamp: (offset / sampleRate) * 1_000_000, // microseconds
        data: interleaved,
      });

      this.encoder.encode(audioData);
      audioData.close();

      // Back-pressure
      if (this.encoder.encodeQueueSize > 10) {
        await new Promise<void>(resolve => {
          this.encoder.addEventListener('dequeue', () => resolve(), { once: true });
        });
      }
    }
  }

  async flush(): Promise<void> {
    await this.encoder.flush();
    this.encoder.close();
  }
}
```

### 4.5 Muxer (`src/export/muxer.ts`)

Wraps `mp4-muxer` and `webm-muxer`:

```ts
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';

interface MuxerOptions {
  width: number;
  height: number;
  fps: number;
  codec: 'avc' | 'hevc' | 'vp9' | 'av1';
  videoBitrate: number;
  audioBitrate: number;
  audio: boolean;
  audioCodec: 'aac' | 'opus';
  audioSampleRate: number;
}

class ExportMuxer {
  private muxer: Mp4Muxer<Mp4Target> | WebmMuxer<WebmTarget>;
  private target: Mp4Target | WebmTarget;

  constructor(format: 'mp4' | 'webm', options: MuxerOptions) {
    this.target = format === 'mp4' ? new Mp4Target() : new WebmTarget();

    const MuxerClass = format === 'mp4' ? Mp4Muxer : WebmMuxer;
    this.muxer = new MuxerClass({
      target: this.target,
      video: {
        codec: format === 'mp4' ? 'avc' : (options.codec === 'vp9' ? 'V_VP9' : 'V_AV1'),
        width: options.width,
        height: options.height,
      },
      ...(options.audio ? {
        audio: {
          codec: format === 'mp4' ? 'aac' : 'opus',
          sampleRate: options.audioSampleRate,
          numberOfChannels: 2,
        },
      } : {}),
      firstTimestampBehavior: 'offset',
    });
  }

  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void {
    this.muxer.addVideoChunk(chunk, meta);
  }

  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void {
    this.muxer.addAudioChunk(chunk, meta);
  }

  finalize(): Blob {
    this.muxer.finalize();
    const buffer = (this.target as Mp4Target | WebmTarget).buffer!;
    const mimeType = this.muxer instanceof Mp4Muxer ? 'video/mp4' : 'video/webm';
    return new Blob([buffer], { type: mimeType });
  }
}
```

### 4.6 Resolution helper (`src/export/resolution.ts`)

```ts
interface ResolvedResolution {
  width: number;
  height: number;
}

/**
 * Resolve export resolution from options.
 * - If both width and height given: use them (user accepts potential distortion).
 * - If only width: compute height from timeline aspect ratio, round to even.
 * - If only height: compute width from timeline aspect ratio, round to even.
 * - If neither: use timeline resolution.
 *
 * WebCodecs requires even dimensions for most codecs.
 */
function resolveExportResolution(
  resolution: { width?: number; height?: number } | undefined,
  timelineWidth: number,
  timelineHeight: number,
): ResolvedResolution {
  if (!resolution) return roundEven(timelineWidth, timelineHeight);

  const aspect = timelineWidth / timelineHeight;
  let w = resolution.width;
  let h = resolution.height;

  if (w && h) return roundEven(w, h);
  if (w) return roundEven(w, Math.round(w / aspect));
  if (h) return roundEven(Math.round(h * aspect), h);
  return roundEven(timelineWidth, timelineHeight);
}

function roundEven(w: number, h: number): ResolvedResolution {
  return {
    width: w % 2 === 0 ? w : w + 1,
    height: h % 2 === 0 ? h : h + 1,
  };
}
```

### 4.7 Download helper (`src/export/download.ts`)

```ts
function triggerDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Don't revoke immediately — browser needs time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}
```

---

## 5. Quality Presets and Bitrate Scaling

Bitrates scale linearly with pixel count relative to 1080p:

```ts
const QUALITY_BITRATES_1080P: Record<string, number> = {
  high:     8_000_000,   // 8 Mbps
  balanced: 4_000_000,   // 4 Mbps
  low:      1_500_000,   // 1.5 Mbps
};

function resolveBitrate(
  quality: 'high' | 'balanced' | 'low',
  width: number,
  height: number,
): number {
  const pixels = width * height;
  const ref = 1920 * 1080;
  const scale = pixels / ref;
  return Math.round(QUALITY_BITRATES_1080P[quality] * scale);
}
```

---

## 6. Codec / Format Compatibility Matrix

| Format | Supported Codecs | Audio Codec | Notes |
|--------|-----------------|-------------|-------|
| mp4    | avc (H.264)     | aac         | Broadest device compatibility |
| mp4    | hevc (H.265)    | aac         | Requires browser HEVC encoder support |
| webm   | vp9             | opus        | Good quality, open format |
| webm   | av1             | opus        | Best compression, slower encode, newer browsers only |

Default per format:
- `mp4` → `avc` video + `aac` audio
- `webm` → `vp9` video + `opus` audio

Before encoding, we call `VideoEncoder.isConfigSupported()` to verify the browser supports the chosen codec+resolution+bitrate. If unsupported, throw a descriptive error.

---

## 7. Integration with Timeline

### 7.1 Methods added to Timeline

```ts
class Timeline {
  // ... existing ...

  /** Export and download the composition as a video file. */
  async export(options?: ExportOptions): Promise<ExportResult> {
    this.emit('export-start');
    try {
      const resolved = resolveExportOptions(options, this);
      const pipeline = new ExportPipeline(this, resolved);
      const result = await pipeline.run();
      triggerDownload(result.blob, resolved.filename);
      this.emit('export-complete', result);
      return result;
    } catch (err) {
      this.emit('export-error', err as Error);
      throw err;
    }
  }

  /** Export the composition and return the blob without downloading. */
  async exportBlob(options?: ExportOptions): Promise<ExportResult> {
    this.emit('export-start');
    try {
      const resolved = resolveExportOptions(options, this);
      const pipeline = new ExportPipeline(this, resolved);
      const result = await pipeline.run();
      this.emit('export-complete', result);
      return result;
    } catch (err) {
      this.emit('export-error', err as Error);
      throw err;
    }
  }
}
```

### 7.2 Events added to TimelineEvents

```ts
type TimelineEvents = {
  // existing...
  'export-start': [];
  'export-progress': [progress: number];
  'export-complete': [result: ExportResult];
  'export-error': [error: Error];
};
```

The `export-progress` event is emitted by the pipeline via a callback that Timeline passes in.

---

## 8. React Integration

### 8.1 useExport hook (`src/react/hooks/export.ts`)

```ts
class SubmodulePreviewHooksExport {
  use(timeline: Timeline): UseExportResult {
    const [progress, setProgress] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const exportVideo = useCallback(async (options?: ExportOptions) => {
      setError(null);
      setIsExporting(true);
      setProgress(0);
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const result = await timeline.export({
          ...options,
          signal: controller.signal,
          onProgress: (p) => setProgress(p),
        });
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsExporting(false);
        setProgress(null);
        controllerRef.current = null;
      }
    }, [timeline]);

    const cancel = useCallback(() => {
      controllerRef.current?.abort();
    }, []);

    return { exportVideo, cancel, progress, isExporting, error };
  }
}
```

### 8.2 Add to PreviewHooks

```ts
class PreviewHooks {
  // ... existing ...
  static readonly export = new SubmodulePreviewHooksExport();
}
```

### 8.3 Add convenience re-export

```ts
// src/react/index.ts
export function useExport(timeline: Timeline) {
  return PreviewHooks.export.use(timeline);
}
```

---

## 9. Exported Types (additions to `src/index.ts`)

```ts
// From export module
export type { ExportOptions, ExportResult } from './export/types';
```

---

## 10. Implementation Steps (Ordered)

### Phase 1 — Resolution and Types

**Step 1: Export types** (`src/export/types.ts`)
- Define `ExportOptions`, `ExportResult`, codec string maps, quality presets.

**Step 2: Resolution resolver** (`src/export/resolution.ts`)
- Implement `resolveExportResolution()`.
- Implement `resolveBitrate()`.
- Test: `tests/export/resolution.test.ts` — aspect ratio preservation, even rounding, all quality presets.

### Phase 2 — Encoding Bridges

**Step 3: VideoEncoderBridge** (`src/export/video-encoder-bridge.ts`)
- Wrap WebCodecs `VideoEncoder`.
- Codec support check via `VideoEncoder.isConfigSupported()`.
- Back-pressure via `dequeue` event.

**Step 4: AudioEncoderBridge** (`src/export/audio-encoder-bridge.ts`)
- Wrap WebCodecs `AudioEncoder`.
- Convert `AudioBuffer` → `AudioData` chunks.
- Test: can be unit-tested with mocked `AudioEncoder`.

### Phase 3 — Muxer and Download

**Step 5: Muxer wrapper** (`src/export/muxer.ts`)
- Wrap `mp4-muxer` and `webm-muxer`.
- Format-aware codec routing.

**Step 6: Download trigger** (`src/export/download.ts`)
- Blob URL creation, `<a>` click trick, deferred revocation.

**Step 7: Install dependencies**
- `npm install mp4-muxer webm-muxer`

### Phase 4 — Frame Production

**Step 8: FrameProducer** (`src/export/frame-producer.ts`)
- Offscreen canvas creation at export resolution.
- Reuse existing `Compositor` and `MediaPool`.
- Frame-accurate video seeking (wait for `seeked` event).
- `VideoFrame` construction from `OffscreenCanvas`.

### Phase 5 — Pipeline Assembly

**Step 9: ExportPipeline** (`src/export/export-pipeline.ts`)
- Orchestrate frame production → video encoding → audio encoding → muxing.
- Progress reporting.
- AbortSignal handling.
- Offline audio rendering via `OfflineAudioContext`.

**Step 10: Export index** (`src/export/index.ts`)
- Re-export `ExportPipeline` and types.

### Phase 6 — Timeline Integration

**Step 11: Add export methods to Timeline** (`src/timeline.ts`)
- Add `export()` and `exportBlob()` methods.
- Add export events to `TimelineEvents`.
- Wire progress callback to `emit('export-progress')`.

**Step 12: Update main exports** (`src/index.ts`)
- Export `ExportOptions`, `ExportResult` types.

### Phase 7 — React

**Step 13: useExport hook** (`src/react/hooks/export.ts`)
- Implement `SubmodulePreviewHooksExport`.
- Add to `PreviewHooks`.

**Step 14: Re-export from react index** (`src/react/index.ts`)
- Export `useExport`.

### Phase 8 — Tests

**Step 15: Unit tests**
- `tests/export/resolution.test.ts` — resolution math, bitrate scaling.
- `tests/export/export-pipeline.test.ts` — mock WebCodecs, verify frame count, codec config, abort handling.
- `tests/react/use-export.test.tsx` — hook state transitions.

### Phase 9 — Example Update

**Step 16: Update preview example**
- Add an "Export" button to `examples/preview/` that calls `timeline.export()`.

---

## 11. Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| WebCodecs vs MediaRecorder | WebCodecs | Frame-level control, hardware acceleration, quality control. MediaRecorder lacks bitrate/resolution control and can't render offline |
| WebCodecs vs FFmpeg WASM | WebCodecs | Native browser API, no 20MB WASM download, GPU acceleration |
| mp4-muxer/webm-muxer vs manual muxing | Libraries | Battle-tested, tiny (~15KB each), correct container specs |
| Offline audio render | OfflineAudioContext | Batch render is simpler than real-time; no sync issues; produces clean AudioBuffer for encoding |
| Export on Timeline (not separate class) | Timeline methods | Consistent with existing API (`mountPreview`, `getFrameAt`); Timeline has access to all clip data |
| Trigger download by default | `export()` downloads, `exportBlob()` doesn't | Most common use case is download; power users get blob for upload/display |
| Codec selection vs hardware selection | Codec-level API | WebCodecs abstracts hardware; user picks what they want (H.264 for compatibility, AV1 for quality), browser handles the rest |

---

## 12. Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebCodecs VideoEncoder | 94+ | 130+ | 16.4+ | 94+ |
| WebCodecs AudioEncoder | 94+ | 130+ | 16.4+ | 94+ |
| OfflineAudioContext | all | all | all | all |
| OffscreenCanvas | 69+ | 105+ | 16.4+ | 79+ |
| VideoFrame | 94+ | 130+ | 16.4+ | 94+ |

**Minimum:** Chrome/Edge 94, Firefox 130, Safari 16.4.

For browsers without WebCodecs, `timeline.export()` should throw a clear error:
```
Error: WebCodecs API is not supported in this browser. Export requires Chrome 94+, Firefox 130+, Safari 16.4+, or Edge 94+.
```

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| WebCodecs not available | Feature-detect `typeof VideoEncoder !== 'undefined'`; throw descriptive error |
| Large video = high memory (all frames + encoded chunks) | Stream chunks to muxer immediately; `VideoFrame.close()` after encoding; back-pressure on encoder queue |
| Video seeking during export is slow | Pre-load videos; wait for `seeked` event per frame; consider `requestVideoFrameCallback` for precision |
| CORS blocks fetch of audio for `OfflineAudioContext.decodeAudioData` | Same CORS requirements as preview; document that sources must be same-origin or CORS-enabled |
| AAC encoder not available in some browsers | Fallback to opus (webm) if AAC encoding fails; or use pcm + mp4-muxer's raw audio support |
| Export blocks main thread | Yield every N frames with `setTimeout(0)`; future: move to Web Worker with OffscreenCanvas |
| AV1 encoding is very slow | Default to `avc` for mp4, `vp9` for webm; document AV1 as opt-in for best compression |
