# Vidio – SDK usage and API design

This doc defines the **AI-friendly TypeScript SDK** for programmatic video editing: timeline, clips (video, image, audio, text, effects), positioning, and layering. The goal is a clear, composable API that could drive a Premiere/DaVinci-like editor.

---

## Design principles

- **Timeline as canvas**: One `Timeline` with fixed dimensions (e.g. 1080×720). All visual clips are positioned and sized relative to this canvas.
- **Position and size**: For `x`, `y`, `width`, `height`: **number** = pixels (absolute); **string** = percentage (relative), e.g. `'50%'`, `'100%'`. No separate px/relative fields.
- **Tracks**: Each clip goes on either **video tracks** or **audio tracks** depending on its kind (video/image/text/effect → video tracks; audio → audio tracks). The **track** option is the index of the track within that family (e.g. video track 0, 1, 2… or audio track 0, 1, 2…). Stacking order within a track is **automatically assigned** (zIndex is not user-settable).
- **Clip kinds**: Classes (`VideoClip`, `ImageClip`, `AudioClip`, `TextClip`, `EffectClip`) instantiated with `new XxxClip(options)`; each kind has the right `src`/content and options; TypeScript guides you.

---

## Core types

```ts
import { Timeline, VideoClip, ImageClip, AudioClip, TextClip, EffectClip } from 'videditor';
import type { Placement, Source, Clip } from 'videditor';

// ---------------------------------------------------------------------------
// Timeline: default dimensions and optional fps/duration
// ---------------------------------------------------------------------------

/** Options when constructing the timeline. Dimensions define the composition canvas. */
// type TimelineOptions = { width: number; height: number; fps?: number; durationSeconds?: number; }

// Example: create a 1080×720 timeline (e.g. for social or preview).
const timeline = new Timeline({
  width: 1080,
  height: 720,
  fps: 30,
});

// ---------------------------------------------------------------------------
// Placement: where and how a visual clip appears on the canvas
// ---------------------------------------------------------------------------
//
// x, y, width, height can be RELATIVE or ABSOLUTE:
//   - NUMBER  = absolute in PIXELS (e.g. 540, 1920).
//   - STRING  = relative as PERCENTAGE of timeline dimension (e.g. '0%', '50%', '100%', '50.23%').
//
// (x, y) is a point ON THE TIMELINE where the clip’s anchor is placed.
// The ANCHOR is which point OF THE CLIP is pinned to that timeline position.
//
// Examples (all relative with percentage strings):
//   ('50%', '50%') + anchor 'center'     → the clip’s center is at the center of the timeline.
//   ('50%', '50%') + anchor 'top-left'   → the clip’s top-left corner is at the center of the timeline
//                                          (clip extends right and down from center).
//   ('0%', '0%') + anchor 'top-left'     → the clip’s top-left corner is at the timeline’s top-left.
//   ('100%', '100%') + anchor 'bottom-right' → the clip’s bottom-right at the timeline’s bottom-right.
//

/** Which point of the clip is pinned to the (x, y) position on the timeline. */
type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** Relative value: percentage of timeline dimension, e.g. '0%', '50%', '100%', '50.23%'. */
type RelativeValue = `${number}%`;

/** Position and size. Number = pixels (absolute). String = percentage (relative), e.g. '50%', '100%'. */
type Placement = {
  /** Horizontal position: pixels (number) or percentage of timeline width (string, e.g. '50%'). */
  x?: number | RelativeValue;
  /** Vertical position: pixels (number) or percentage of timeline height (string, e.g. '50%'). */
  y?: number | RelativeValue;
  /** Clip width: pixels (number) or percentage of timeline width (string, e.g. '100%'). */
  width?: number | RelativeValue;
  /** Clip height: pixels (number) or percentage of timeline height (string, e.g. '100%'). */
  height?: number | RelativeValue;
  /** Which point of the clip is pinned at (x, y). Default 'center'. */
  anchor?: Anchor;
  /** Rotation in degrees. Default 0. */
  rotation?: number;
  /** Opacity 0–1. Default 1. */
  opacity?: number;
};

// ---------------------------------------------------------------------------
// Source: what the clip references (URL, data URL, buffer, etc.)
// ---------------------------------------------------------------------------

/** Supported source types for media (video, image, audio). */
type Source = string | URL | ArrayBuffer | Uint8Array | Buffer;

// - URL string: 'https://example.com/video.mp4'
// - Data URL: 'data:video/mp4;base64,...' or 'data:image/png;base64,...'
// - Binary: ArrayBuffer, Uint8Array, Node Buffer
```

---

## Clip classes and time

All clips share **time** and **track** (constructor options); visual clips add **placement**. Each clip kind is a class: construct with `new VideoClip(options)`, etc.

**Track and stacking:**

- **Video tracks** hold: video clips, image clips, text clips, effect clips. `track: 0` = first video track, `track: 1` = second, etc.
- **Audio tracks** hold: audio clips only. `track: 0` = first audio track, etc.
- Stacking order within a track (who is on top) is **automatically assigned**; you do not set zIndex.

```ts
/** Options shared by every clip (time and track). zIndex is auto-assigned, not user-settable. */
// start: number; duration: number; in?: number; out?: number; track?: number;

/** Video clip: motion picture with placement on the canvas. */
// new VideoClip({ src, start, duration, placement?, in?, out?, track?, audio? })
//
// audio (default true): when true, adding this VideoClip is handled by breaking it into two
//   separate clips: the video (audio stripped) and an AudioClip with the same src and
//   same start/duration/in/out. Internally the video clip is stored with audio: false,
//   and a separate AudioClip is appended. When audio: false, only the video clip is added.
// Use false for silent video or when you will add your own audio.

/** Image clip: still image with placement. */
// new ImageClip({ src, start, duration, placement?, in?, out?, track? })

/** Audio clip: no placement; lives on audio tracks. */
// new AudioClip({ src, start, duration, in?, out?, track? })

/** Text clip: on-screen text with optional styling and placement. */
// new TextClip({ text, start, duration, placement?, style?, track? })
// style: { fontSize?, fontFamily?, fontWeight?, color?, backgroundColor?, padding?, align? }

/** Effect clip: applies an effect to a track or to the composition (e.g. color grade, blur). */
// new EffectClip({ effect, start, duration, params?, track? })

/** Union of all clip kinds (for type signatures). */
type Clip = VideoClip | ImageClip | AudioClip | TextClip | EffectClip;
```

---

## Timeline API (conceptual)

```ts
class Timeline {
  constructor(options: { width: number; height: number; fps?: number; durationSeconds?: number });

  /** Composition width in pixels. */
  readonly width: number;
  /** Composition height in pixels. */
  readonly height: number;
  /** Frames per second. */
  readonly fps: number;

  /** Update the composition resolution. All placement (relative %) is recomputed for the new size. */
  setResolution(width: number, height: number): this;

  /** Add a clip to the timeline. Returns the timeline for chaining. */
  add(clip: Clip): this;

  /** Remove a clip by id (if clips are identified) or by reference. */
  remove(clipOrId: Clip | string): this;

  /** Get all clips in timeline order (by start, then track). When a VideoClip is added with audio: true, getClips() returns both the video clip and the generated audio clip. */
  getClips(): readonly Clip[];

  /** Get total duration in seconds (derived from clips or from options). */
  getDuration(): number;

  /**
   * Export the timeline to a file. The output format is determined by the file extension.
   * Supported extensions: .mp4, .webm, .gif
   * (gif exports video without audio). Returns the path of the written file.
   */
  export(outputPath: string): Promise<string>;
}
```

---

## Example 1: Single video full-screen

```ts
const timeline = new Timeline({ width: 1080, height: 720 });

timeline.add(
  new VideoClip({
    src: 'https://example.com/hero.mp4',
    start: 0,
    duration: 10,
    // Full canvas: relative position and size
    placement: {
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      anchor: 'center',
    },
  }),
);
```

---

## Example 2: Image and text overlay (layering with tracks)

```ts
const timeline = new Timeline({ width: 1080, height: 720 });

// Background image – track 0 (bottom)
timeline.add(
  new ImageClip({
    src: 'https://example.com/background.jpg',
    start: 0,
    duration: 15,
    track: 0,
    placement: {
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      anchor: 'center',
    },
  }),
);

// Title on top – track 1
timeline.add(
  new TextClip({
    text: 'Welcome',
    start: 1,
    duration: 5,
    track: 1,
    placement: {
      x: '50%',
      y: '15%',
      anchor: 'top-center',
    },
    style: {
      fontSize: 0.08,
      fontFamily: 'Inter',
      color: '#ffffff',
      align: 'center',
    },
  }),
);
```

---

## Example 3: Picture-in-picture (relative positioning)

```ts
// Main video full-screen; second video as PiP bottom-right
const timeline = new Timeline({ width: 1080, height: 720 });

timeline.add(
  new VideoClip({
    src: 'main.mp4',
    start: 0,
    duration: 60,
    track: 0,
    placement: { x: '50%', y: '50%', width: '100%', height: '100%', anchor: 'center' },
  }),
);

timeline.add(
  new VideoClip({
    src: 'pip.mp4',
    start: 10,
    duration: 50,
    track: 1,
    placement: {
      x: '85%',
      y: '85%',
      width: '25%',
      height: '25%',
      anchor: 'bottom-right',
    },
  }),
);
```

---

## Example 4: Audio track and effect

```ts
const timeline = new Timeline({ width: 1080, height: 720 });

timeline.add(
  new VideoClip({
    src: 'video.mp4',
    start: 0,
    duration: 20,
    track: 0,
    placement: { x: '50%', y: '50%', width: '100%', height: '100%', anchor: 'center' },
  }),
);

// Music bed – audio has no placement
timeline.add(
  new AudioClip({
    src: 'music.mp3',
    start: 0,
    duration: 20,
    track: 0,
    in: 5,
    out: 25,
  }),
);

// Fade-in effect on the whole composition
timeline.add(
  new EffectClip({
    effect: 'fade',
    start: 0,
    duration: 1,
    track: 0,
    params: { from: 0, to: 1 },
  }),
);
```

---

## Example 5: Two clips on different video tracks

```ts
const timeline = new Timeline({ width: 1080, height: 720 });

// Background on video track 0; logo on video track 1 (drawn on top). Stacking is automatic.
timeline.add(
  new ImageClip({
    src: 'back.png',
    start: 0,
    duration: 10,
    track: 0,
    placement: { x: '50%', y: '50%', width: '100%', height: '100%', anchor: 'center' },
  }),
);
timeline.add(
  new ImageClip({
    src: 'logo.png',
    start: 2,
    duration: 8,
    track: 1,
    placement: {
      x: '50%',
      y: '90%',
      width: '20%',
      height: '10%',
      anchor: 'bottom-center',
    },
  }),
);
```

---

## Example 6: Trim and placement defaults

```ts
const timeline = new Timeline({ width: 1080, height: 720 });

// If placement is omitted for a visual clip, default to full canvas.
// If in/out are omitted, use full source.
timeline.add(
  new VideoClip({
    src: 'long.mp4',
    start: 0,
    duration: 5,
    in: 10,
    out: 15,
    // placement omitted => full canvas, center anchor
    // audio: true (default) => internally stored as video-only + separate AudioClip with same timestamps/duration
  }),
);
```

---

## Example 7: Video with audio: false

```ts
const timeline = new Timeline({ width: 1080, height: 720 });

// Silent video only; no separate audio clip is added. Use when the file has no audio
// or you will add your own music/voiceover.
timeline.add(
  new VideoClip({
    src: 'silent-b-roll.mp4',
    start: 0,
    duration: 10,
    audio: false,
    placement: { x: '50%', y: '50%', width: '100%', height: '100%', anchor: 'center' },
  }),
);
```

---

## Example 8: Resolution and export

```ts
const timeline = new Timeline({ width: 1080, height: 720 });

timeline.add(
  new VideoClip({
    src: 'clip.mp4',
    start: 0,
    duration: 5,
    placement: { x: '50%', y: '50%', width: '100%', height: '100%', anchor: 'center' },
  }),
);

// Change output resolution before export (e.g. for a smaller file or different aspect).
// This should fix the anchor at the middle by default (so { anchor: 'center' } has that value by default), such that if you for example change the layout from horizontal 1080 x 720 to vertical (e.g. 120 x 960), it fixes the new video portrait at the chosen anchor. If it were top-left, then the new portrait would be placed at .
// This only applies if aspect ratio changes. If it's just scaling, (which should be able to do with timeline.scale(scalingFactor), where scalingFactor can be 0.5, 1 to stay the same, 2 to make it twice as much...), then it runs .scale() to rescale the resolution.
timeline.setResolution(1920, 1080, { anchor: 'center' });

// Export: format is inferred from extension. Supported: .mp4, .webm, .gif (gif has no audio).
// Should be able to export in base64 format too as:
// await timeline.exportBase64('mp4')
// await timeline.exportBuffer('mp4') -> this would be a buffer or arraybuffer or the like representing the extension (here mp4) encoding
const path = await timeline.export('./output.mp4');
// or: await timeline.export('./output.gif');
```

---

## Preview and real-time editing

The SDK targets **video editor applications**: users edit in the timeline and expect to see changes quickly. That implies two distinct modes:

- **Preview** — Interactive, low-latency feedback. No full re-encode.
- **Export** — Final output to file (MP4, WebM, GIF). Full decode → composite → encode; can take seconds to minutes.

### Why rebuilding the entire video is not real-time

A full **export** pipeline does: decode every source clip → composite every frame (placement, tracks, effects) → encode to the output format. For a 10‑minute timeline at 30fps that’s 18,000 frames of decode + composite + encode. Even with FFmpeg or hardware encoders, that’s not suitable for “preview on every scrub or trim.” So:

- **Export** = full rebuild, run only when the user explicitly exports (or when generating a final proxy).
- **Preview** = no encoding step; decode and composite only, and only for what’s needed to display.

### How to make preview fast: decode + composite, no encode

Preview stays fast by **skipping encoding**:

1. **Decode** only the frames needed for the current view (see below).
2. **Composite** them in memory (canvas, WebGL, or a similar 2D stack) according to the timeline’s placement and tracks.
3. **Display** the result in a `<video>`-like surface (canvas, or a short in-memory stream). No writing a full-length file.

So the same timeline model (clips, placement, tracks) drives both:

- **Preview path**: timeline → “render frame at time T” → pixels (or a short decoded segment) → shown in the editor.
- **Export path**: timeline → full render → encode → file (or buffer/base64).

### Rendering a window (before/after seconds) vs full timeline

Two viable strategies:

- **Full-timeline preview**  
  For each frame at time `t`, determine which clips are active, decode those frames (or use already-decoded/cached frames), composite, and draw. Good for short timelines or when you have a strong caching/decoding strategy. Can be heavy if many long clips or many sources.

- **Window-based preview (recommended for heavy timelines)**  
  Only decode and composite a **time window** around the playhead (e.g. “from `currentTime - 2s` to `currentTime + 3s`”). When the user scrubs, the window moves; you can reuse cached decoded frames where the new window overlaps the old one. This keeps work per “preview update” bounded and makes scrubbing feel responsive. The editor can still show a full timeline strip (e.g. thumbnails, waveforms) while the **video preview** is window-based.

So: “render some before–after seconds” is a good approach. The SDK can expose something like `previewWindowSeconds` (or `previewRange: { start, end }`) so the editor developer can choose how much to render per update. Default could be a few seconds; for short projects, the “window” can be the whole timeline.

### How the editor app gets and loads the preview

The **programmer building the video editor** needs a clear way to “play” the timeline without calling `export()`. Options the SDK can offer:

| Approach                      | Description                                                                                                                                                                                                   | Best for                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Preview URL**               | SDK (or a small optional server/worker) exposes a URL that serves the current preview (e.g. a short MP4 segment or a live stream for the current window). Editor sets `<video src={previewUrl} />`.           | Simple integration; editor reuses native `<video>` for playback and sync.                                           |
| **Frame callback / iterator** | SDK calls a callback (or async iterator) with frame data at a given time: e.g. `ImageBitmap`, `ImageData`, or raw buffer. Editor draws to canvas and controls playback (requestAnimationFrame + currentTime). | Full control over rendering (e.g. custom canvas/WebGL, overlays, scopes).                                           |
| **Preview component**         | SDK provides a small component (e.g. React) that owns a canvas or video element and receives `timeline` + `currentTime`; it handles decoding/compositing and playback internally.                             | Fastest integration: editor mounts `<Preview timeline={timeline} currentTime={t} />` and gets playback and seeking. |

**Suggested API shape (conceptual):**

```ts
// Option A: Preview as a URL the editor can bind to <video>
// (SDK or optional module starts a small server or worker that serves the current window.)
const previewUrl = timeline.getPreviewUrl({ windowSeconds?: number });
// Editor: <video src={previewUrl} />

// Option B: Frame-based; editor drives time and draws each frame.
timeline.previewFrames({
  range: { start: 0, end: 10 }, // in seconds; can be float to represent milliseconds and the like too
  fps: 30,
  onFrame: (time, imageDataOrBitmap) => { /* draw to canvas */ },
});

// Option C: Component (e.g. React); SDK owns the preview surface.
<Preview timeline={timeline} currentTime={playhead} width={640} height={360} />
```

The editor developer then:

- **Loads** the preview by using the URL in a `<video>`, or by feeding frame callbacks to their canvas, or by mounting the preview component.
- **Syncs** the playhead: when the user scrubs, they update `currentTime` (or the time range) and the preview updates to that window; no need to re-export the whole project.

### Summary: preview vs export

|              | Preview                                                | Export                                  |
| ------------ | ------------------------------------------------------ | --------------------------------------- |
| **Goal**     | Real-time or near–real-time feedback while editing     | Final file (or buffer/base64)           |
| **Pipeline** | Decode + composite only (optionally for a time window) | Full decode → composite → encode        |
| **Output**   | Pixels / short segment / URL for display               | File path, buffer, or base64            |
| **When**     | On scrub, play, or timeline change                     | On user “Export” (or explicit API call) |

So: **editing and preview** use the same timeline model but a lightweight “render frame(s) for time T (or window)” path; **export** uses the full rebuild path. The SDK can support both and let the editor choose how to consume the preview (URL, frame callback, or component).

---

## Preview surface: framework-agnostic and play state

### Preview surface: canvas vs iframe, one primitive for all

Goal: one preview primitive that works in **vanilla JS**, **React**, **Vue**, **Electron**, etc., without duplicating logic.

- **Canvas (recommended)**  
  The SDK accepts a **container element** (e.g. a `div`) and creates/manages a single `<canvas>` inside it. It draws each frame via the same pipeline as `getFrameAt(time)` (decode + composite). No iframe, no cross-origin or postMessage. The host just passes a ref or DOM node. Works identically in any framework.

- **iframe**  
  Use only if you need strong isolation (e.g. untrusted content, separate origin). For a video editor preview it adds complexity (postMessage, URL or blob for content) and is usually unnecessary. Prefer canvas for the default.

**API shape:**

- **Core (vanilla / any framework):** `timeline.mountPreview(container: HTMLElement, options?)` → returns a handle with `destroy()`, and optionally `seek(t)`, `play()`, `pause()` if the timeline owns playback (see below). The preview listens to timeline events (`timeupdate`, `clip-added`, etc.) and redraws. The host can also drive time externally by calling `timeline.seek(t)` and not using timeline play/pause.
- **React:** Optional package `@videditor/react`: e.g. `usePreview(timeline, options)` that returns `{ ref, currentTime, isPlaying, play, pause, seek }` and a `<Preview timeline={timeline} />` that uses a ref and mounts the same canvas primitive internally. Same behavior as vanilla; only the wiring is React-friendly.
- **Vue / others:** Same primitive: pass a ref to the container and call `timeline.mountPreview(container, options)`. A Vue composable can wrap that and expose `currentTime`, `isPlaying`, `play`, `pause`, `seek` the same way.

So: **one rendering path** (canvas + `getFrameAt` / frame stream), **one mount API** (container element), and thin framework adapters (hook/composable + optional component) that call that API. No separate "React preview" vs "vanilla preview" implementation.

### Clips with ID: update and remove by ID

Make the timeline **ID-based** so the UI can update or remove clips without holding references.

- **ID:** Every clip has a stable `id`. If the user does not provide one in options, the SDK auto-generates it (e.g. UUID or `clip_${Date.now()}_${i}`). `timeline.add(clip)` returns the same clip (or a clip descriptor) with `id` set; the plan already has `remove(clipOrId)`.
- **Update:** `timeline.updateClip(id: string, patch: Partial<ClipOptions>)` — e.g. change `start`, `duration`, `placement`, or `text` for a text clip. Only allowed fields per clip kind. Fires `clip-changed` (or `clip-updated`) so the preview and panels can refresh.
- **Queries:** `timeline.getClip(id)`, `timeline.getClips()` (already in plan). Panels and preview subscribe to `clip-added` | `clip-removed` | `clip-changed` and re-render from `getClips()` or by updating the single clip in place.

Refactor all clip kinds so that their options type includes optional `id?: string` and the timeline assigns one on `add` if missing. Then the editor can do:

- Add: `timeline.add(new VideoClip({ ... }))` (id assigned).
- Update: `timeline.updateClip(id, { start: 2, duration: 5 })`.
- Remove: `timeline.remove(id)`.

This keeps the UI simple: list of clips keyed by id, and every mutation goes through the timeline so preview stays in sync via events.

### Play state: timeline as single source of truth (recommended)

**Recommendation: the timeline (SDK) owns playback and current time.** The UI only calls methods and subscribes to events; it does not run its own timer and push time into the SDK every frame.

**Flow:**

1. User clicks **Play** in the UI → UI calls `timeline.play()` (optionally `timeline.play(startTime?)` if you want to support "play from here").
2. Timeline starts an internal clock (e.g. `requestAnimationFrame` or a timer at timeline `fps`), advances `currentTime`, and emits a **timeupdate** (or **tick**) event on each frame or at a throttled rate.
3. The **preview** (canvas) is just another subscriber: on `timeupdate` it calls `getFrameAt(currentTime)` and draws. The **UI** (playhead, timecode) subscribes to `timeupdate` and updates the displayed playhead.
4. User clicks **Pause** → UI calls `timeline.pause()`; timeline stops the clock and optionally emits one more `timeupdate` with the final time.
5. User **scrubs** → UI calls `timeline.seek(t)`; timeline sets `currentTime`, emits `timeupdate`; preview and UI update from that single event.

**Why not the opposite (UI owns a counter and pushes time every ms)?**

- You get **two sources of truth** (UI time vs SDK time), which can drift.
- The SDK doesn't know if it's playing or paused, so it can't optimize (e.g. preload next frame when playing).
- The UI has to implement timing, looping, and end-of-timeline behavior that the SDK could handle once (e.g. `timeline.on('ended')`).

So: **timeline owns** `currentTime`, `playing`, `play()`, `pause()`, `seek(t)` and emits `timeupdate` (and optionally `play`, `pause`, `ended`). The UI is a thin layer: buttons call `timeline.play()` / `timeline.pause()` / `timeline.seek(t)` and listen to `timeupdate` to show the playhead; the preview listens to `timeupdate` and redraws. No per-millisecond "push time to preview" in the app code.

**Optional host-driven mode:** For rare cases where the host must drive time (e.g. external sync), you can support a **passive** mode: no `play()`/`pause()` on the timeline; the host calls `timeline.seek(t)` on every frame or at its own rate. Then the timeline is just "frame at T" and does not run a clock. Most editors should use the **timeline-driven** mode above.

**Suggested API addition:**

```ts
// Playback (timeline-driven)
timeline.play(startTime?: number): void;   // start from startTime or currentTime
timeline.pause(): void;
timeline.seek(time: number): void;
timeline.currentTime: number;              // readonly, in seconds
timeline.playing: boolean;                 // readonly

timeline.on('timeupdate', (time: number) => void);
timeline.on('play' | 'pause' | 'ended', () => void);

// Clips by ID
timeline.add(clip: Clip): this;           // assigns id if missing, returns this
timeline.updateClip(id: string, patch: Partial<…>): this;
timeline.remove(clipOrId: Clip | string): this;
timeline.getClip(id: string): Clip | undefined;
```

With this, "click Play in the UI" is simply: call `timeline.play()` and subscribe to `timeupdate` (and optionally `ended`) to keep the playhead and preview in sync. No separate counter in the UI.

---

## Summary: OOP API

| Aspect                 | Recommendation                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| **Timeline**           | `new Timeline({ width, height, fps? })`; readonly `width`, `height`, `fps`; `setResolution(width, height)` to update; `export(outputPath)` to write file (.mp4, .webm, .gif).                           |
| **Clips**              | Classes: `new VideoClip(options)`, `new ImageClip(options)`, `new AudioClip(options)`, `new TextClip(options)`, `new EffectClip(options)`.                                                              |
| **Adding clips**       | `timeline.add(clip)`; assigns `id` if missing, returns `this` for chaining.                                                                                                                               |
| **Updating clips**     | `timeline.updateClip(id, patch)`; partial update by ID; fires `clip-changed`.                                                                                                                            |
| **Removing**           | `timeline.remove(clipOrId)`; `timeline.getClip(id)` for lookup.                                                                                                                                          |
| **Playback**           | Timeline owns time: `play(startTime?)`, `pause()`, `seek(t)`; readonly `currentTime`, `playing`; events `timeupdate`, `play`, `pause`, `ended`. UI subscribes; no UI-owned counter.                    |
| **Preview mount**      | `timeline.mountPreview(container, options?)` → canvas in container, works vanilla/React/Vue; optional `@videditor/react`: `usePreview()`, `<Preview />`.                                                |
| **Positioning**        | `Placement`: x, y, width, height as number (px) or string (e.g. `'50%'`), anchor, optional rotation/opacity.                                                                                            |
| **Tracks**             | `track` = index in video tracks (video/image/text/effect) or audio tracks (audio). Stacking within a track is auto-assigned (no user zIndex).                                                           |
| **VideoClip audio**    | `audio` (default true): when true, the clip is broken into two—video-only (stored with audio: false) and a separate AudioClip with same src/timestamps/duration; when false, only the video clip.       |
| **Time**               | `start` + `duration` on timeline; optional `in`/`out` for source trim.                                                                                                                                  |
| **Preview (agnostic)** | `getFrameAt(time, options?)` → single frame for scrub/thumbnails; `previewFrames({ range, fps?, signal?, onFrame? })` → callback stream or async iterator; both support `AbortSignal` for cancellation. |
| **Timeline events**    | `timeline.on('clip-added' | 'clip-removed' | 'clip-changed' | 'resolution-changed' | 'timeupdate' | 'play' | 'pause' | 'ended', handler)` returns unsubscribe; use to refresh preview and playhead. |
| **Optional packages**  | `@videditor/react`: `<Preview>`, `usePreviewFrame`, `usePreviewFrames`. Optional preview-URL module and `@videditor/electron` for URL-based preview and Electron conveniences.                          |

This gives you a clear, OOP surface: one `Timeline` class, five clip classes, `add`/`remove`/`getClips`/`getDuration`/`setResolution`/`export`, with relative placement, video/audio tracks, optional split of video+audio, **agnostic preview APIs** (single frame + frame stream with cancellation and events), and optional React/Electron packages for best-in-class DX.
