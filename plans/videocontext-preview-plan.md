# VideoContext-Inspired Canvas Preview Renderer
## Implementation Plan for `reelkit` SDK

**Date:** 2026-03-09
**Scope:** Canvas-based real-time preview, new Timeline/Clip object model, React integration

---

## 1. Context and Goals

The existing `reelkit` SDK is Node.js-only and server-side: it uses FFmpeg to produce frames as PNG
buffers or short MP4 segments, which are served over HTTP to a `<video>` element in the browser.
This works for simple playback but is unsuitable for:

- Sub-frame scrubbing (each seek triggers an FFmpeg spawn)
- Real-time playback at full fps without pre-exporting a segment
- Live timeline editing with instant visual feedback
- Embedded preview in a React application without a backend

The new system introduces:

1. A browser-native **Timeline + Clip object model** (replacing VidioMedia's chainable API for the
   composition layer)
2. A **canvas-based real-time renderer** that composites frames on `<canvas>` using HTMLVideoElement
   + HTMLImageElement decode, with no encode step
3. A **React integration package** (`@videditor/react` or `/react` subpath) with hooks and a
   `<Preview>` component
4. The **export path** (FFmpeg, Node.js only) remains unchanged but is driven by the same Timeline
   model

BBC VideoContext's key ideas borrowed (not code-copied):
- Canvas is the rendering surface (2D or WebGL compositing)
- `requestAnimationFrame` drives the internal clock
- Real-time decode via browser-native media elements (HTMLVideoElement per source)
- A node-graph mental model for effects (implemented as EffectClip in our layered system)

---

## 2. File and Module Structure

```
src/
├── index.ts                        # Main entry: re-exports Timeline, all Clip classes, types
│
├── timeline.ts                     # Timeline class (playback, clip registry, events, resolution)
│
├── clips/
│   ├── base-clip.ts                # Abstract BaseClip: id, start, duration, in, out, track
│   ├── video-clip.ts               # VideoClip
│   ├── image-clip.ts               # ImageClip
│   ├── audio-clip.ts               # AudioClip
│   ├── text-clip.ts                # TextClip
│   ├── effect-clip.ts              # EffectClip (shader / canvas filter descriptor)
│   └── index.ts                    # Re-exports all clip classes and union type
│
├── renderer/
│   ├── canvas-renderer.ts          # CanvasRenderer: owns the <canvas>, RAF loop, draw dispatch
│   ├── placement.ts                # resolvePlacement(): % → px, anchor offsets, rotation matrix
│   ├── media-pool.ts               # MediaPool: HTMLVideoElement / HTMLImageElement cache per src
│   ├── text-renderer.ts            # TextRenderer: draws TextClip onto an OffscreenCanvas
│   ├── effect-node.ts              # EffectNode: wraps WebGL shader or canvas filter for EffectClip
│   └── compositor.ts               # Compositor: orchestrates track ordering and effect application
│
├── audio/
│   └── audio-engine.ts             # AudioEngine: Web Audio API graph for AudioClip scheduling
│
├── events/
│   └── emitter.ts                  # Typed EventEmitter (tiny, no dependency)
│
└── react/
    ├── index.ts                    # Re-exports all hooks and <Preview> component
    ├── use-timeline.ts             # useTimeline() hook
    ├── use-preview.ts              # usePreview() hook
    ├── use-clips.ts                # useClips() hook
    ├── use-playback.ts             # usePlayback() hook
    └── preview-component.tsx       # <Preview> component

plans/
├── sdk-plan.md                     # Existing API design doc
├── hw.md                          # Hardware encoder notes
└── videocontext-preview-plan.md   # This document

tests/
├── helpers.ts                     # Existing
├── timeline.test.ts               # Timeline unit tests (new)
├── placement.test.ts              # Placement math unit tests (new)
├── canvas-renderer.test.ts        # Renderer integration tests using jsdom (new)
└── react/
    └── hooks.test.tsx              # React hook tests using @testing-library/react (new)
```

### Build configuration additions

`tsdown.config.ts` needs a second entry point for the React subpath:

```ts
// tsdown.config.ts (updated)
export default defineConfig([
  {
    entry: ['src/index.ts'],           // main package entry
    format: ['esm'],
    // ...
  },
  {
    entry: ['src/react/index.ts'],     // /react subpath
    format: ['esm'],
    outDir: 'dist/react',
    external: ['react', 'react-dom'], // peer deps, not bundled
    // ...
  },
]);
```

`package.json` exports:

```json
{
  "exports": {
    ".": { "import": "./dist/index.mjs", "types": "./dist/index.d.ts" },
    "./react": { "import": "./dist/react/index.mjs", "types": "./dist/react/index.d.ts" }
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  }
}
```

---

## 3. Core Data Model

### 3.1 Shared Types (`src/clips/base-clip.ts`)

```ts
/** Anchor point: which point of the clip is pinned to (x, y) on the canvas. */
type Anchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

type RelativeValue = `${number}%`;

interface Placement {
  x?: number | RelativeValue;
  y?: number | RelativeValue;
  width?: number | RelativeValue;
  height?: number | RelativeValue;
  anchor?: Anchor;
  rotation?: number;   // degrees, default 0
  opacity?: number;    // 0–1, default 1
}

interface BaseClipOptions {
  id?: string;
  start: number;         // timeline position (seconds)
  duration: number;      // how long on timeline (seconds)
  in?: number;           // source trim start (seconds into source)
  out?: number;          // source trim end (seconds into source)
  track?: number;        // track index within its family (video or audio)
}

abstract class BaseClip {
  readonly id: string;          // assigned on construction or by Timeline.add()
  start: number;
  duration: number;
  in?: number;
  out?: number;
  track: number;
  abstract readonly kind: 'video' | 'image' | 'audio' | 'text' | 'effect';
}
```

The `id` is auto-generated (e.g. `crypto.randomUUID()` or a sequential counter) if not provided.

### 3.2 Clip Classes

Each class extends `BaseClip` and adds kind-specific fields:

```ts
class VideoClip extends BaseClip {
  kind = 'video' as const;
  src: Source;
  placement: Placement;
  audio: boolean;             // default true; when true, Timeline.add() also creates an AudioClip
}

class ImageClip extends BaseClip {
  kind = 'image' as const;
  src: Source;
  placement: Placement;
}

class AudioClip extends BaseClip {
  kind = 'audio' as const;
  src: Source;
  // no placement; lives on audio tracks
}

class TextClip extends BaseClip {
  kind = 'text' as const;
  text: string;
  placement: Placement;
  style: TextStyle;           // fontSize, fontFamily, color, backgroundColor, align, etc.
}

class EffectClip extends BaseClip {
  kind = 'effect' as const;
  effect: string;             // e.g. 'fade', 'blur', 'color-grade'
  params?: Record<string, unknown>;
  // track: which video track it applies to, or -1 for composition-wide
}
```

### 3.3 Source type

```ts
type Source = string | URL | ArrayBuffer | Uint8Array | Buffer;
```

In the browser context (renderer), `Source` is always a URL string or data URL. The renderer
resolves it to a `src` attribute on `HTMLVideoElement` / `HTMLImageElement`. Node Buffer is only
relevant for the export path.

---

## 4. Timeline Class (`src/timeline.ts`)

### 4.1 Interface sketch

```ts
type TimelineEvents = {
  'clip-added': [clip: Clip];
  'clip-removed': [clip: Clip];
  'clip-changed': [clip: Clip, patch: Partial<unknown>];
  'resolution-changed': [width: number, height: number];
  'timeupdate': [time: number];
  'play': [];
  'pause': [];
  'ended': [];
};

class Timeline {
  constructor(options: { width: number; height: number; fps?: number });

  // Resolution
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  setResolution(width: number, height: number, options?: { anchor?: Anchor }): this;

  // Clip management
  add(clip: Clip): this;
  remove(clipOrId: Clip | string): this;
  getClip(id: string): Clip | undefined;
  getClips(): readonly Clip[];
  updateClip(id: string, patch: Partial<ClipOptions>): this;
  getDuration(): number;

  // Playback (owned by Timeline)
  readonly currentTime: number;
  readonly playing: boolean;
  play(startTime?: number): void;
  pause(): void;
  seek(time: number): void;

  // Events
  on<K extends keyof TimelineEvents>(event: K, handler: (...args: TimelineEvents[K]) => void): () => void;
  off<K extends keyof TimelineEvents>(event: K, handler: (...args: TimelineEvents[K]) => void): void;

  // Preview
  mountPreview(container: HTMLElement, options?: PreviewOptions): PreviewHandle;

  // Frame access
  getFrameAt(time: number): Promise<ImageBitmap>;
  previewFrames(options: PreviewFramesOptions): () => void;  // returns cancel fn

  // Export (Node.js only)
  export(outputPath: string): Promise<string>;
  exportBase64(format: 'mp4' | 'webm' | 'gif'): Promise<string>;
  exportBuffer(format: 'mp4' | 'webm' | 'gif'): Promise<Uint8Array>;
}
```

### 4.2 Internal clip registry

```ts
// Internal map: id → Clip
private _clips: Map<string, Clip>;

// Sorted view: video tracks (by track asc, then start asc), audio tracks separate
// Re-sorted on every add/remove/update that changes track or start
private _videoTrackOrder: VideoLike[];   // VideoClip | ImageClip | TextClip | EffectClip
private _audioTrackOrder: AudioClip[];
```

### 4.3 add() logic for VideoClip with audio: true

```
Timeline.add(videoClip: VideoClip):
  1. Assign id if missing.
  2. If videoClip.audio === true (default):
     a. Store videoClip with audio: false internally.
     b. Create a companion AudioClip with same src, start, duration, in, out.
     c. Add companion AudioClip with its own id.
     d. Emit 'clip-added' for videoClip, then for audioClip.
  3. Else: store as-is, emit 'clip-added'.
```

### 4.4 Playback clock

```ts
// Internal RAF-based clock (browser) or setInterval (Node.js)
private _rafId: number | null;
private _clockOrigin: number;     // performance.now() at play start
private _clockTimeAtPlay: number; // currentTime at play start

play(startTime?: number): void {
  if (this.playing) return;
  const t = startTime ?? this._currentTime;
  this._currentTime = t;
  this._clockOrigin = performance.now();
  this._clockTimeAtPlay = t;
  this._playing = true;
  this._tick();
  this._emit('play');
}

private _tick(): void {
  this._rafId = requestAnimationFrame(() => {
    const elapsed = (performance.now() - this._clockOrigin) / 1000;
    const next = this._clockTimeAtPlay + elapsed;
    const end = this.getDuration();
    if (next >= end) {
      this._currentTime = end;
      this._playing = false;
      this._emit('timeupdate', end);
      this._emit('ended');
      return;
    }
    this._currentTime = next;
    this._emit('timeupdate', next);
    this._tick();
  });
}

seek(time: number): void {
  const clamped = Math.max(0, Math.min(time, this.getDuration()));
  this._currentTime = clamped;
  if (this.playing) {
    // Reset clock origin so elapsed time is measured from the new position
    this._clockOrigin = performance.now();
    this._clockTimeAtPlay = clamped;
  }
  this._emit('timeupdate', clamped);
}
```

---

## 5. Canvas Renderer (`src/renderer/`)

### 5.1 Overview

The renderer receives the Timeline model and a `<canvas>` element. It:
1. Subscribes to `timeupdate`, `clip-added`, `clip-removed`, `clip-changed`, `resolution-changed`.
2. On each `timeupdate`, calls `drawFrame(time)`.
3. `drawFrame(time)` determines active clips at `time`, resolves their placement, draws them
   bottom-up by track order.
4. Uses a `MediaPool` to reuse `HTMLVideoElement` and `HTMLImageElement` instances.
5. Uses an `AudioEngine` to schedule `AudioClip` playback via Web Audio API.

### 5.2 CanvasRenderer (`src/renderer/canvas-renderer.ts`)

```ts
interface PreviewOptions {
  width?: number;   // override canvas CSS width (default: fills container)
  height?: number;  // override canvas CSS height
  pixelRatio?: number;   // devicePixelRatio (default: window.devicePixelRatio)
  renderMode?: '2d' | 'webgl';  // default '2d'; 'webgl' for shader effects
}

interface PreviewHandle {
  canvas: HTMLCanvasElement;
  destroy(): void;
  // Convenience delegation to Timeline playback (same as calling timeline.play/pause/seek)
  // These are thin proxies; Timeline remains the single source of truth.
}

class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;  // or WebGLRenderingContext
  private timeline: Timeline;
  private pool: MediaPool;
  private audio: AudioEngine;
  private compositor: Compositor;
  private unsubscribers: Array<() => void>;

  constructor(timeline: Timeline, container: HTMLElement, options: PreviewOptions) {
    // 1. Create <canvas>, set dimensions from timeline.width * pixelRatio
    // 2. Append canvas to container
    // 3. Get 2D or WebGL context
    // 4. Instantiate MediaPool, AudioEngine, Compositor
    // 5. Subscribe to timeline events:
    //    - 'timeupdate' → this.drawFrame(time)
    //    - 'clip-added' / 'clip-removed' → pool.invalidate(clip)
    //    - 'resolution-changed' → this.resizeCanvas()
    //    - 'play' → audio.play()
    //    - 'pause' → audio.pause()
  }

  drawFrame(time: number): void {
    const { width, height } = this.timeline;
    this.ctx.clearRect(0, 0, width, height);

    // Get clips active at `time`, sorted by track (ascending = bottom → top)
    const active = this.getActiveClips(time);
    for (const clip of active) {
      this.compositor.draw(this.ctx, clip, time, { width, height });
    }
  }

  private getActiveClips(time: number): Clip[] {
    return this.timeline.getClips().filter(clip => {
      return clip.start <= time && time < clip.start + clip.duration;
    }).sort((a, b) => (a.track ?? 0) - (b.track ?? 0));
  }

  async getFrameAt(time: number): Promise<ImageBitmap> {
    this.drawFrame(time);
    return createImageBitmap(this.canvas);
  }

  resizeCanvas(): void {
    const { width, height } = this.timeline;
    const pr = this.pixelRatio;
    this.canvas.width = width * pr;
    this.canvas.height = height * pr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.scale(pr, pr);
    // Redraw at currentTime after resize
    this.drawFrame(this.timeline.currentTime);
  }

  destroy(): void {
    this.unsubscribers.forEach(fn => fn());
    this.pool.destroy();
    this.audio.destroy();
    this.canvas.remove();
  }
}
```

### 5.3 Placement math (`src/renderer/placement.ts`)

The `resolvePlacement` function converts a `Placement` (mix of % strings and px numbers) to
absolute pixel values on the canvas, then computes the draw origin given the anchor.

```ts
interface ResolvedPlacement {
  x: number;      // top-left draw origin in canvas pixels
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

function resolvePlacement(
  placement: Placement,
  canvasWidth: number,
  canvasHeight: number,
  intrinsicWidth: number,   // natural width of the media source (pixels)
  intrinsicHeight: number,
): ResolvedPlacement {
  // 1. Parse x, y, width, height: if string ending in '%' → value * canvasDimension / 100
  //    if number → treat as px directly.
  const x = parseDim(placement.x ?? '50%', canvasWidth);
  const y = parseDim(placement.y ?? '50%', canvasHeight);
  const w = parseDim(placement.width ?? intrinsicWidth, canvasWidth);
  const h = parseDim(placement.height ?? intrinsicHeight, canvasHeight);

  // 2. Compute anchor offset: which point of the clip is at (x, y).
  //    'center' → draw at (x - w/2, y - h/2)
  //    'top-left' → draw at (x, y)
  //    'bottom-right' → draw at (x - w, y - h)
  //    etc.
  const [ox, oy] = anchorOffset(placement.anchor ?? 'center', w, h);

  return {
    x: x - ox,
    y: y - oy,
    width: w,
    height: h,
    rotation: placement.rotation ?? 0,
    opacity: placement.opacity ?? 1,
  };
}

// Anchor offset table:
// top-left:      (0,   0)
// top-center:    (w/2, 0)
// top-right:     (w,   0)
// center-left:   (0,   h/2)
// center:        (w/2, h/2)
// center-right:  (w,   h/2)
// bottom-left:   (0,   h)
// bottom-center: (w/2, h)
// bottom-right:  (w,   h)
```

Rotation is applied via `ctx.save() / ctx.translate(cx, cy) / ctx.rotate(rad) / ctx.translate(-cx, -cy)` where `(cx, cy)` is the clip's geometric center.

### 5.4 MediaPool (`src/renderer/media-pool.ts`)

One `HTMLVideoElement` per unique source URL. The pool:
- Creates elements lazily on first access.
- Sets `src`, `preload="auto"`, `crossOrigin="anonymous"`, `muted` (for autoplay rules).
- Seeks to `clipLocalTime` (= `timeline.currentTime - clip.start + (clip.in ?? 0)`) before drawing.
- For playing: `video.play()` is NOT called in the pool; instead, the renderer seeks on each
  `drawFrame`. For smooth playback, it calls `video.currentTime = localTime` each frame.
- Provides `getVideoElement(src: Source): HTMLVideoElement`.
- Provides `getImageElement(src: Source): HTMLImageElement` (loads once, cached).
- `destroy()` pauses and removes all elements.

```ts
class MediaPool {
  private videos: Map<string, HTMLVideoElement>;
  private images: Map<string, HTMLImageElement>;

  getVideoElement(src: string): HTMLVideoElement {
    if (!this.videos.has(src)) {
      const el = document.createElement('video');
      el.src = src;
      el.preload = 'auto';
      el.muted = true;
      el.crossOrigin = 'anonymous';
      // Do NOT append to DOM; just use as decode source
      this.videos.set(src, el);
    }
    return this.videos.get(src)!;
  }

  getImageElement(src: string): HTMLImageElement {
    if (!this.images.has(src)) {
      const el = new Image();
      el.src = src;
      el.crossOrigin = 'anonymous';
      this.images.set(src, el);
    }
    return this.images.get(src)!;
  }

  destroy(): void {
    for (const v of this.videos.values()) {
      v.pause();
      v.src = '';
    }
    this.videos.clear();
    this.images.clear();
  }
}
```

**Note on seeking:** `HTMLVideoElement.currentTime` assignment is async (it fires `seeked` event
when done). For smooth real-time preview, the renderer should set `video.currentTime` and then
draw. On the first frame after a seek there may be a one-frame lag. To handle this, the compositor
can listen for `video.seeked` and trigger a redraw, or use `requestVideoFrameCallback` (where
supported) for frame-accurate rendering. This is noted as a known limitation with `requestVideoFrameCallback` as an enhancement.

### 5.5 Compositor (`src/renderer/compositor.ts`)

The compositor knows how to draw each clip kind onto the canvas context:

```ts
class Compositor {
  constructor(private pool: MediaPool) {}

  draw(ctx: CanvasRenderingContext2D, clip: Clip, time: number, canvas: { width: number; height: number }): void {
    switch (clip.kind) {
      case 'video': return this.drawVideo(ctx, clip, time, canvas);
      case 'image': return this.drawImage(ctx, clip, time, canvas);
      case 'text':  return this.drawText(ctx, clip, time, canvas);
      case 'effect': return this.applyEffect(ctx, clip, time, canvas);
      case 'audio': return; // handled by AudioEngine, not drawn
    }
  }

  private drawVideo(ctx, clip: VideoClip, time, canvas): void {
    const local = time - clip.start + (clip.in ?? 0);
    const el = this.pool.getVideoElement(clip.src as string);
    // Seek video to local time
    if (Math.abs(el.currentTime - local) > 0.05) {
      el.currentTime = local;
    }
    const p = resolvePlacement(clip.placement, canvas.width, canvas.height, el.videoWidth, el.videoHeight);
    this.applyTransformAndDraw(ctx, el, p);
  }

  private drawImage(ctx, clip: ImageClip, time, canvas): void {
    const el = this.pool.getImageElement(clip.src as string);
    if (!el.complete) return; // not loaded yet; will redraw on load event
    const p = resolvePlacement(clip.placement, canvas.width, canvas.height, el.naturalWidth, el.naturalHeight);
    this.applyTransformAndDraw(ctx, el, p);
  }

  private drawText(ctx, clip: TextClip, time, canvas): void {
    // Use TextRenderer to paint text; get cached OffscreenCanvas
    const textCanvas = TextRenderer.render(clip, canvas);
    const p = resolvePlacement(clip.placement, canvas.width, canvas.height, textCanvas.width, textCanvas.height);
    this.applyTransformAndDraw(ctx, textCanvas, p);
  }

  private applyEffect(ctx, clip: EffectClip, time, canvas): void {
    // Look up EffectNode by clip.effect string
    // Apply WebGL shader or canvas filter
  }

  private applyTransformAndDraw(ctx, source, p: ResolvedPlacement): void {
    ctx.save();
    ctx.globalAlpha = p.opacity;
    if (p.rotation !== 0) {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(source, p.x, p.y, p.width, p.height);
    ctx.restore();
  }
}
```

### 5.6 TextRenderer (`src/renderer/text-renderer.ts`)

Text clips are rendered to an `OffscreenCanvas` and cached by a hash of `(text + style)`. This
avoids redrawing text on every frame unless the clip changes.

```ts
class TextRenderer {
  private static cache: Map<string, OffscreenCanvas> = new Map();

  static render(clip: TextClip, canvas: { width: number; height: number }): OffscreenCanvas {
    const key = JSON.stringify({ text: clip.text, style: clip.style });
    if (this.cache.has(key)) return this.cache.get(key)!;

    const fontSize = (clip.style?.fontSize ?? 0.05) * canvas.height;
    const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
    const ctx = offscreen.getContext('2d')!;

    ctx.font = `${clip.style?.fontWeight ?? 'normal'} ${fontSize}px ${clip.style?.fontFamily ?? 'sans-serif'}`;
    ctx.fillStyle = clip.style?.color ?? '#ffffff';
    ctx.textAlign = (clip.style?.align ?? 'left') as CanvasTextAlign;
    ctx.textBaseline = 'top';

    // Measure text, optionally draw background
    const metrics = ctx.measureText(clip.text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.2;

    if (clip.style?.backgroundColor) {
      const padding = clip.style.padding ?? 0;
      ctx.fillStyle = clip.style.backgroundColor;
      ctx.fillRect(-padding, -padding, textWidth + padding * 2, textHeight + padding * 2);
      ctx.fillStyle = clip.style.color ?? '#ffffff';
    }

    ctx.fillText(clip.text, 0, 0);
    this.cache.set(key, offscreen);
    return offscreen;
  }

  static invalidate(clip: TextClip): void {
    const key = JSON.stringify({ text: clip.text, style: clip.style });
    this.cache.delete(key);
  }
}
```

### 5.7 EffectClip and the Node-Graph for Effects

`EffectClip` is a lightweight descriptor. The renderer maps `effect` strings to `EffectNode`
implementations. Two rendering modes:

**Mode A — Canvas filter (simple effects):**
Apply `ctx.filter = 'blur(4px)'` or opacity/brightness/contrast before drawing the composite.
Works in all browsers, zero WebGL required.

**Mode B — WebGL shader (advanced effects):**
For cross-dissolve, color grade, etc., the renderer composites to an intermediate
`OffscreenCanvas`, uploads it as a WebGL texture, applies the shader, and blits the result to the
main canvas. This is the VideoContext-inspired approach.

For the initial implementation, only Mode A (canvas filter) is required. Mode B can be added in a
later step. The `EffectClip` descriptor approach makes this pluggable:

```ts
interface EffectNode {
  name: string;
  // Mode A: return a CSS filter string (or null for no filter)
  getFilter(time: number, clip: EffectClip): string | null;
  // Mode B (optional): take a source OffscreenCanvas, return a processed one
  process?(source: OffscreenCanvas, time: number, clip: EffectClip): OffscreenCanvas;
}

// Registry
const effectRegistry = new Map<string, EffectNode>();

// Built-in effects
effectRegistry.set('fade', {
  name: 'fade',
  getFilter(time, clip) {
    const from = clip.params?.from as number ?? 0;
    const to = clip.params?.to as number ?? 1;
    const progress = (time - clip.start) / clip.duration;
    const opacity = from + (to - from) * progress;
    return `opacity(${opacity})`;
  },
});

effectRegistry.set('blur', {
  name: 'blur',
  getFilter(time, clip) {
    return `blur(${clip.params?.intensity ?? 4}px)`;
  },
});
```

The compositor calls `effectRegistry.get(clip.effect)?.getFilter(time, clip)` and sets
`ctx.filter` before drawing the subsequent layer.

### 5.8 Track ordering and EffectClip application

Track ordering rules:
1. Clips are sorted ascending by `track` (0 = bottom, higher = top).
2. `EffectClip` on `track: N` applies to the composite state after all clips on track `N-1` and
   `N` have been drawn, before clips on `track: N+1` are drawn.
3. A composition-wide `EffectClip` (track `-1` or a special `scope: 'composition'` flag) applies
   as a post-processing step after all tracks are composited.

Draw order pseudocode:

```
for trackIndex from 0 to maxTrack:
  clipsOnTrack = activeClips.filter(c => c.track === trackIndex)
  effectsOnTrack = clipsOnTrack.filter(c => c.kind === 'effect')
  mediaOnTrack = clipsOnTrack.filter(c => c.kind !== 'effect' && c.kind !== 'audio')

  for clip in mediaOnTrack:
    compositor.draw(ctx, clip, time, canvas)

  for effect in effectsOnTrack:
    applyEffect(ctx, effect, time, canvas)
```

### 5.9 AudioEngine (`src/audio/audio-engine.ts`)

Uses the Web Audio API. One `AudioContext` per `CanvasRenderer`. Each `AudioClip` gets a
`AudioBufferSourceNode` (for decoded audio) or `MediaElementAudioSourceNode` (from
HTMLVideoElement). Scheduling:

- On `play`: for each active `AudioClip`, schedule its `AudioBufferSourceNode.start(audioCtx.currentTime, offset)`.
- On `pause`: suspend the `AudioContext`.
- On `seek`: stop all nodes, reschedule from new position.
- Video clip audio (when `audio: true` on VideoClip): the companion `AudioClip` handles audio via
  the AudioEngine; the video element is always `muted`.

```ts
class AudioEngine {
  private ctx: AudioContext;
  private nodes: Map<string, AudioBufferSourceNode | MediaElementAudioSourceNode>;

  play(clips: AudioClip[], currentTime: number): void { ... }
  pause(): void { this.ctx.suspend(); }
  seek(clips: AudioClip[], newTime: number): void {
    this.stopAll();
    this.play(clips, newTime);
  }
  destroy(): void { this.ctx.close(); }
}
```

---

## 6. mountPreview and PreviewHandle (`src/timeline.ts`)

```ts
// On Timeline:
mountPreview(container: HTMLElement, options?: PreviewOptions): PreviewHandle {
  const renderer = new CanvasRenderer(this, container, options ?? {});
  // Draw current frame immediately (even if not playing)
  renderer.drawFrame(this.currentTime);
  return {
    canvas: renderer.canvas,
    destroy: () => renderer.destroy(),
  };
}
```

Multiple calls to `mountPreview` are supported (e.g. a main preview + a thumbnail strip). Each
creates an independent `CanvasRenderer` with its own canvas and subscriptions.

---

## 7. getFrameAt and previewFrames

### 7.1 getFrameAt

```ts
async getFrameAt(time: number): Promise<ImageBitmap> {
  // Use an off-screen CanvasRenderer (no container) or the existing renderer
  // if one is mounted. The renderer draws at the given time and returns the bitmap.
  const renderer = this._offscreenRenderer ?? this._createOffscreenRenderer();
  return renderer.getFrameAt(time);
}
```

The offscreen renderer is a `CanvasRenderer` with an `OffscreenCanvas` instead of a
`HTMLCanvasElement`. It is created lazily and destroyed when the Timeline is destroyed.

### 7.2 previewFrames

```ts
interface PreviewFramesOptions {
  range: { start: number; end: number };
  fps?: number;
  signal?: AbortSignal;
  onFrame: (time: number, frame: ImageBitmap) => void;
}

previewFrames(options: PreviewFramesOptions): () => void {
  const { range, fps = this.fps, signal, onFrame } = options;
  let cancelled = false;
  signal?.addEventListener('abort', () => { cancelled = true; });

  const step = 1 / fps;
  let t = range.start;

  async function run() {
    while (t <= range.end && !cancelled) {
      const frame = await this.getFrameAt(t);
      if (cancelled) break;
      onFrame(t, frame);
      t += step;
      // Yield to event loop between frames
      await new Promise(r => setTimeout(r, 0));
    }
  }

  run();
  return () => { cancelled = true; };
}
```

The returned cancel function and the `AbortSignal` both stop the iteration.

---

## 8. setResolution behavior

```ts
setResolution(width: number, height: number, options?: { anchor?: Anchor }): this {
  // 1. Store old dimensions.
  // 2. Update this.width and this.height.
  // 3. If the renderer has a mounted canvas, resize it.
  // 4. The 'resolution-changed' event triggers CanvasRenderer.resizeCanvas().
  // 5. All placement values expressed as percentages automatically recompute at draw time
  //    because resolvePlacement() takes canvasWidth/Height as parameters.
  //    No stored px values need to be updated.
  // 6. Absolute (px) placements do NOT change; they remain at their pixel values.
  //    If the developer changes from 1080x720 to 1920x1080 and had absolute placements,
  //    those clips may appear off-center. This is expected behavior.
  this._emit('resolution-changed', width, height);
  return this;
}
```

The `anchor` option in `setResolution` applies when aspect ratio changes — placement coordinates
expressed as percentages naturally adapt; absolute coordinates stay fixed.

---

## 9. React Integration (`src/react/`)

### 9.1 useTimeline

```ts
function useTimeline(options: { width: number; height: number; fps?: number }): Timeline {
  // Stable ref: never re-created across renders unless options deeply change.
  // Simple approach: create once with useMemo on a stable options ref.
  const ref = useRef<Timeline | null>(null);
  if (ref.current === null) {
    ref.current = new Timeline(options);
  }
  return ref.current;
}
```

Note: resolution updates should be done via `timeline.setResolution()`, not by changing the
`options` argument (which would require re-creating the timeline and losing all clips).

### 9.2 usePreview

```ts
interface UsePreviewResult {
  ref: RefObject<HTMLDivElement | null>;
  currentTime: number;
  isPlaying: boolean;
  play: (startTime?: number) => void;
  pause: () => void;
  seek: (time: number) => void;
}

function usePreview(timeline: Timeline, options?: PreviewOptions): UsePreviewResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(timeline.currentTime);
  const [isPlaying, setIsPlaying] = useState(timeline.playing);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handle = timeline.mountPreview(container, options);
    return () => handle.destroy();
  }, [timeline]);   // re-mount only if timeline instance changes

  useEffect(() => {
    const unsub1 = timeline.on('timeupdate', (t) => setCurrentTime(t));
    const unsub2 = timeline.on('play', () => setIsPlaying(true));
    const unsub3 = timeline.on('pause', () => setIsPlaying(false));
    const unsub4 = timeline.on('ended', () => setIsPlaying(false));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [timeline]);

  return {
    ref: containerRef,
    currentTime,
    isPlaying,
    play: (t) => timeline.play(t),
    pause: () => timeline.pause(),
    seek: (t) => timeline.seek(t),
  };
}
```

### 9.3 useClips

```ts
function useClips(timeline: Timeline): readonly Clip[] {
  const [clips, setClips] = useState<readonly Clip[]>(timeline.getClips());

  useEffect(() => {
    const refresh = () => setClips(timeline.getClips());
    const u1 = timeline.on('clip-added', refresh);
    const u2 = timeline.on('clip-removed', refresh);
    const u3 = timeline.on('clip-changed', refresh);
    return () => { u1(); u2(); u3(); };
  }, [timeline]);

  return clips;
}
```

### 9.4 usePlayback

```ts
interface UsePlaybackResult {
  currentTime: number;
  isPlaying: boolean;
  play: (startTime?: number) => void;
  pause: () => void;
  seek: (time: number) => void;
}

function usePlayback(timeline: Timeline): UsePlaybackResult {
  const [currentTime, setCurrentTime] = useState(timeline.currentTime);
  const [isPlaying, setIsPlaying] = useState(timeline.playing);

  useEffect(() => {
    const u1 = timeline.on('timeupdate', setCurrentTime);
    const u2 = timeline.on('play', () => setIsPlaying(true));
    const u3 = timeline.on('pause', () => setIsPlaying(false));
    const u4 = timeline.on('ended', () => setIsPlaying(false));
    return () => { u1(); u2(); u3(); u4(); };
  }, [timeline]);

  return {
    currentTime,
    isPlaying,
    play: (t) => timeline.play(t),
    pause: () => timeline.pause(),
    seek: (t) => timeline.seek(t),
  };
}
```

### 9.5 Preview component

```tsx
interface PreviewProps {
  timeline: Timeline;
  style?: React.CSSProperties;
  className?: string;
  previewOptions?: PreviewOptions;
}

function Preview({ timeline, style, className, previewOptions }: PreviewProps) {
  const { ref } = usePreview(timeline, previewOptions);
  return (
    <div
      ref={ref}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      className={className}
    />
  );
}
```

The `<Preview>` component is a thin shell; it delegates everything to `usePreview`. The canvas
is appended inside the div by `CanvasRenderer`. The canvas scales to fill the container via its
own `width`/`height` attributes.

### 9.6 Usage example (inspired by getrx reactive patterns)

```tsx
import { Timeline, VideoClip, TextClip } from 'reelkit';
import { useTimeline, usePlayback, useClips, Preview } from 'reelkit/react';

function VideoEditor() {
  const timeline = useTimeline({ width: 1280, height: 720, fps: 30 });
  const { currentTime, isPlaying, play, pause, seek } = usePlayback(timeline);
  const clips = useClips(timeline);

  // Add a clip on mount
  useEffect(() => {
    timeline.add(new VideoClip({
      src: '/video.mp4',
      start: 0,
      duration: 10,
      placement: { x: '50%', y: '50%', width: '100%', height: '100%', anchor: 'center' },
    }));
  }, [timeline]);

  return (
    <div>
      {/* Preview: mounts canvas inside this component */}
      <Preview
        timeline={timeline}
        style={{ width: 640, height: 360 }}
      />

      {/* Controls */}
      <button onClick={() => isPlaying ? pause() : play()}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={timeline.getDuration()}
        step={0.01}
        value={currentTime}
        onChange={e => seek(Number(e.target.value))}
      />
      <span>{currentTime.toFixed(2)}s</span>

      {/* Clip list — auto-updates on add/remove */}
      <ul>
        {clips.map(clip => (
          <li key={clip.id}>{clip.kind} @ {clip.start}s</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 10. EventEmitter (`src/events/emitter.ts`)

A minimal typed event emitter, no external dependencies:

```ts
type Handler<T extends unknown[]> = (...args: T) => void;

class TypedEmitter<Events extends Record<string, unknown[]>> {
  private handlers: Map<string, Set<Handler<unknown[]>>> = new Map();

  on<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as Handler<unknown[]>);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown[]>);
  }

  protected emit<K extends keyof Events & string>(event: K, ...args: Events[K]): void {
    this.handlers.get(event)?.forEach(h => h(...args));
  }
}
```

`Timeline` extends `TypedEmitter<TimelineEvents>`.

---

## 11. Memory and Resource Management

| Resource | Lifecycle | Cleanup |
|---|---|---|
| HTMLVideoElement per src | Created by MediaPool on first access | Paused and src-cleared in MediaPool.destroy() |
| HTMLImageElement per src | Created by MediaPool on first access | Cleared in MediaPool.destroy() |
| OffscreenCanvas (TextRenderer cache) | Per (text + style) hash | TextRenderer.invalidate(clip) on clip-changed |
| AudioContext | One per CanvasRenderer | AudioEngine.destroy() calls ctx.close() |
| RAF loop | Started by Timeline.play() | Cancelled by cancelAnimationFrame on pause/ended |
| Timeline event subscriptions | Created in CanvasRenderer constructor | Stored as unsubscribe functions, called in destroy() |
| CanvasRenderer (offscreen) | Lazy, for getFrameAt() | Destroyed in Timeline.destroy() |
| canvas DOM element | Appended by CanvasRenderer | Removed in CanvasRenderer.destroy() |

`PreviewHandle.destroy()` must be called to release all resources. The React `usePreview` hook
does this automatically in its `useEffect` cleanup function.

### destroy() propagation

```
PreviewHandle.destroy()
  → CanvasRenderer.destroy()
      → MediaPool.destroy()     // pause/clear all video/image elements
      → AudioEngine.destroy()   // close AudioContext
      → unsubscribers.forEach() // remove all timeline event listeners
      → canvas.remove()         // remove <canvas> from DOM
```

If the Timeline itself is discarded (e.g. the editor is closed), call `timeline.destroy()`:

```ts
// On Timeline:
destroy(): void {
  this.pause();
  this._offscreenRenderer?.destroy();
  this._handlers.clear();
}
```

---

## 12. Implementation Steps (Ordered)

### Phase 1 — Core Data Model (no rendering)

**Step 1: EventEmitter** (`src/events/emitter.ts`)
- Implement `TypedEmitter<Events>` class.
- No dependencies.

**Step 2: BaseClip + Clip classes** (`src/clips/`)
- Implement `BaseClip`, `VideoClip`, `ImageClip`, `AudioClip`, `TextClip`, `EffectClip`.
- Each class assigns `id = crypto.randomUUID()` if not provided.
- Export union type `Clip`.

**Step 3: Timeline (data layer only, no rendering)** (`src/timeline.ts`)
- Implement `add`, `remove`, `getClip`, `getClips`, `getDuration`, `updateClip`,
  `setResolution` (emit event, no canvas logic).
- Implement `VideoClip` split logic (audio: true → add companion AudioClip).
- Wire up `TypedEmitter` for `clip-added`, `clip-removed`, `clip-changed`, `resolution-changed`.
- No RAF, no canvas yet.
- Tests: `tests/timeline.test.ts` (add/remove/updateClip, event firing, clip splitting).

### Phase 2 — Placement Math

**Step 4: Placement resolver** (`src/renderer/placement.ts`)
- Implement `parseDim(value, dimensionPx)` — handles `number` and `'50%'` strings.
- Implement `anchorOffset(anchor, w, h)` — returns `[ox, oy]`.
- Implement `resolvePlacement(placement, canvasW, canvasH, intrinsicW, intrinsicH)`.
- Tests: `tests/placement.test.ts` — all 9 anchors, px and % values, edge cases.
- No browser dependency; pure math.

### Phase 3 — Canvas Renderer (browser)

**Step 5: MediaPool** (`src/renderer/media-pool.ts`)
- HTMLVideoElement + HTMLImageElement creation and caching.
- Test in browser (jsdom has limited video support; use a stub/mock in tests).

**Step 6: TextRenderer** (`src/renderer/text-renderer.ts`)
- OffscreenCanvas-based text rendering with style application.
- Cache invalidation on `clip-changed`.

**Step 7: Built-in EffectNodes** (`src/renderer/effect-node.ts`)
- Implement `effectRegistry` with `'fade'`, `'blur'` as canvas filter effects.
- Define the `EffectNode` interface for future extensibility.

**Step 8: Compositor** (`src/renderer/compositor.ts`)
- Implement `draw(ctx, clip, time, canvas)` dispatch.
- Implement `applyTransformAndDraw` with `ctx.save/restore`, opacity, rotation.
- Implement track-ordered effect application.

**Step 9: CanvasRenderer** (`src/renderer/canvas-renderer.ts`)
- Create `<canvas>`, size it from `timeline.width * pixelRatio`.
- Subscribe to timeline events.
- Implement `drawFrame(time)` using Compositor.
- Implement `getFrameAt(time)` using `createImageBitmap`.
- Implement `resizeCanvas()` triggered by `resolution-changed`.
- Implement `destroy()`.

**Step 10: mountPreview on Timeline** (`src/timeline.ts`)
- Instantiate `CanvasRenderer` in `mountPreview`.
- Return `PreviewHandle`.
- Add `destroy()` to Timeline for cleanup.

### Phase 4 — Playback Clock

**Step 11: RAF clock on Timeline** (`src/timeline.ts`)
- Implement `play(startTime?)`, `pause()`, `seek(t)`, `_tick()`.
- Emit `timeupdate`, `play`, `pause`, `ended`.
- The renderer subscribes to `timeupdate` and calls `drawFrame`. No change needed in renderer.
- Test: timeline emits events at correct times (mock `requestAnimationFrame` with vitest fake timers).

### Phase 5 — Audio

**Step 12: AudioEngine** (`src/audio/audio-engine.ts`)
- Web Audio API: schedule AudioClip nodes on play, suspend on pause, reschedule on seek.
- Connect AudioClips from VideoClip companion clips and standalone AudioClips.
- `CanvasRenderer` constructor creates `AudioEngine`; renderer subscribes to `timeline.on('play')`
  and `'pause'` to drive the engine.
- Browser-only; guard with `typeof AudioContext !== 'undefined'`.

### Phase 6 — getFrameAt and previewFrames

**Step 13: Offscreen renderer for getFrameAt** (`src/timeline.ts`)
- Lazy-create an `OffscreenCanvas`-based renderer for thumbnail/scrub use.
- `getFrameAt(time)` draws to offscreen canvas and returns `createImageBitmap`.

**Step 14: previewFrames** (`src/timeline.ts`)
- Implement frame iteration loop with `AbortSignal` support.

### Phase 7 — React Integration

**Step 15: useTimeline** (`src/react/use-timeline.ts`)
- Simple `useRef` initialization.

**Step 16: usePlayback** (`src/react/use-playback.ts`)
- `useState` + `useEffect` subscriptions to timeline events.

**Step 17: useClips** (`src/react/use-clips.ts`)
- `useState` + `useEffect` subscriptions for clip changes.

**Step 18: usePreview** (`src/react/use-preview.ts`)
- `useRef<HTMLDivElement>` + `useEffect` for `mountPreview` / `destroy`.
- Compose from `usePlayback` for playback state.

**Step 19: Preview component** (`src/react/preview-component.tsx`)
- Thin wrapper; uses `usePreview`.

**Step 20: tsdown config + package.json exports**
- Add `/react` subpath entry point.

### Phase 8 — Tests and Polish

**Step 21: Unit tests**
- `tests/timeline.test.ts`: clip CRUD, event firing, getDuration, setResolution.
- `tests/placement.test.ts`: all anchor/% combinations.
- `tests/canvas-renderer.test.ts`: mount/destroy lifecycle, drawFrame calls (mock canvas).
- `tests/react/hooks.test.tsx`: useTimeline, useClips, usePlayback with @testing-library/react.

**Step 22: Integration with existing export path**
- The existing `VidioMedia` / FFmpeg export remains in `src/index.ts`.
- The new `Timeline.export()` creates a `VidioMedia`-equivalent representation of the clips,
  drives them through the FFmpeg pipeline. This is the bridge between the two APIs.
- This step is deferred; the renderer and React integration are fully independent of it.

---

## 13. Architectural Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Canvas vs. iframe | `<canvas>` | No postMessage overhead; works across all frameworks; same draw path as export |
| 2D vs. WebGL | Start with 2D Canvas API | Simpler; covers most effects (opacity, rotation, fade, blur via canvas filter). Add WebGL Mode B for shaders later |
| RAF clock location | Timeline (not renderer) | Single source of truth; multiple renderers (main preview + thumbnail) all stay in sync |
| Audio | Web Audio API | No HTMLVideoElement audio (always muted); avoids sync issues; full control over scheduling |
| MediaPool strategy | One HTMLVideoElement per src | Reuse across frames; seek on each drawFrame for frame-accuracy |
| requestVideoFrameCallback | Future enhancement | More accurate seek; add in a later step after baseline works |
| EffectNode registry | Map<string, EffectNode> | Pluggable; SDK ships built-ins; developers can register custom effects |
| TextRenderer cache | OffscreenCanvas per (text+style) hash | Avoid redraw every frame; invalidate on clip-changed |
| React hooks | useEffect + timeline.on() | No polling; correct cleanup; works with React 18 strict mode double-effect |
| Export path | Bridge from Timeline to VidioMedia (FFmpeg) | Reuses proven Node.js pipeline; preview and export share the same data model |
| ID generation | crypto.randomUUID() | Collision-free; available in modern browsers and Node >= 18 |

---

## 14. Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| HTMLVideoElement.currentTime seek lag causes frame tearing | Use `requestVideoFrameCallback` (where available) to wait for frame readiness; fallback to `seeked` event |
| OffscreenCanvas not available in Safari (older versions) | Feature-detect; fall back to regular canvas for TextRenderer |
| AudioContext requires user gesture | Document that `timeline.play()` must be called from a user event handler; AudioEngine handles the `AudioContext.resume()` call |
| Cross-origin media (CORS) | All media elements set `crossOrigin='anonymous'`; server must send CORS headers; document requirement |
| Memory leak from MediaPool in long-running editors | Add `pool.evict(src)` called by `clip-removed` event; cap pool size |
| Multiple CanvasRenderers fighting over same AudioClip | AudioEngine is per-renderer; only the "primary" renderer should drive audio; document convention |
