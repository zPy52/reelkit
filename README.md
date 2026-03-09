# vidio

`vidio` is a TypeScript SDK for building timeline-based video compositions and previewing them in the browser with a canvas renderer.

The current SDK surface covers:

- Timeline state and playback control
- Video, image, audio, text, and effect clips
- DOM canvas preview mounting
- Offscreen frame capture with `getFrameAt()`
- Browser export to downloadable `mp4` or `webm`
- React helpers from `vidio/react`

## Installation

```bash
npm install vidio
```

React support is exposed as an optional peer entrypoint:

```bash
npm install react react-dom
```

## Quick Start

```ts
import {
  AudioClip,
  EffectClip,
  ImageClip,
  TextClip,
  Timeline,
  VideoClip,
} from 'vidio';

const timeline = new Timeline({
  width: 1280,
  height: 720,
  fps: 30,
});

timeline.add(new ImageClip({
  start: 0,
  duration: 8,
  track: 0,
  src: '/background.jpg',
  placement: {
    x: '50%',
    y: '50%',
    width: '100%',
    height: '100%',
    anchor: 'center',
  },
}));

timeline.add(new VideoClip({
  start: 0,
  duration: 8,
  track: 1,
  src: '/speaker.mp4',
  audio: false,
  placement: {
    x: '50%',
    y: '52%',
    width: '72%',
    height: '72%',
    anchor: 'center',
  },
}));

timeline.add(new TextClip({
  start: 0.4,
  duration: 3,
  track: 2,
  text: 'VidIO',
  placement: {
    x: '8%',
    y: '10%',
    anchor: 'top-left',
  },
  style: {
    fontSize: 56,
    fontWeight: 700,
    color: '#ffffff',
  },
}));

timeline.add(new AudioClip({
  start: 0,
  duration: 8,
  track: 0,
  src: '/music.mp3',
  volume: 0.8,
}));

timeline.add(new EffectClip({
  start: 0,
  duration: 1,
  track: -1,
  effect: 'fade',
  params: { from: 0, to: 1 },
}));
```

Mount a preview:

```ts
const container = document.getElementById('preview');
const preview = timeline.mountPreview(container!);

preview.play();
preview.seek(2.5);
preview.pause();
```

## QA

Repo-level checks:

- `npm test` runs the Vitest unit and integration suite.
- `npm run test:visual` runs the Chromium canvas snapshot suite.
- `npm run test:export-qa` runs browser export smoke and preview/export parity checks.
- `npm run test:qa` runs all of the above in sequence.

For manual inspection, `npm run preview` opens the browser QA gallery in `examples/preview/`.

## Core Concepts

### Timeline

`Timeline` owns composition dimensions, playback state, events, and the clip collection.

```ts
const timeline = new Timeline({ width: 1920, height: 1080, fps: 30 });
```

Main methods:

- `add(clip)`
- `remove(clipOrId)`
- `getClip(id)`
- `getClips()`
- `updateClip(id, patch)`
- `getDuration()`
- `setResolution(width, height)`
- `play(startTime?)`
- `pause()`
- `seek(time)`
- `mountPreview(container, previewOptions?)`
- `getFrameAt(time)`
- `previewFrames({ range, fps?, signal?, onFrame })`
- `export(options?)`
- `exportBlob(options?)`
- `destroy()`

Main state:

- `timeline.width`
- `timeline.height`
- `timeline.fps`
- `timeline.currentTime`
- `timeline.playing`

Events:

- `clip-added`
- `clip-removed`
- `clip-changed`
- `resolution-changed`
- `timeupdate`
- `play`
- `pause`
- `ended`
- `export-start`
- `export-progress`
- `export-complete`
- `export-error`

## Clips

All clips share:

- `id?`
- `start`
- `duration`
- `in?`
- `out?`
- `track?`

Visual clips use `placement`. Audio clips do not.

### VideoClip

```ts
new VideoClip({
  src: '/video.mp4',
  start: 0,
  duration: 6,
  track: 1,
  placement: { x: '50%', y: '50%', width: '100%', height: '100%' },
  audio: true,
  muted: false,
  volume: 1,
});
```

`audio` defaults to `true`. When you add a video clip with audio enabled, the timeline automatically creates a linked `AudioClip` companion.

### ImageClip

```ts
new ImageClip({
  src: '/image.png',
  start: 0,
  duration: 4,
  placement: { x: '50%', y: '50%', width: '60%', height: '60%' },
});
```

### AudioClip

```ts
new AudioClip({
  src: '/audio.mp3',
  start: 0,
  duration: 10,
  track: 0,
  volume: 0.75,
  muted: false,
});
```

### TextClip

```ts
new TextClip({
  text: 'Hello world',
  start: 0,
  duration: 3,
  placement: { x: '50%', y: '15%', anchor: 'top-center' },
  style: {
    fontFamily: 'Georgia, serif',
    fontSize: 48,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 12,
    lineHeight: 1.2,
    letterSpacing: 0,
    align: 'center',
  },
});
```

### EffectClip

```ts
new EffectClip({
  effect: 'blur',
  start: 0,
  duration: 2,
  track: -1,
  params: { intensity: 3 },
});
```

Built-in effects:

- `fade`
- `blur`

Register custom effects with `registerEffectNode()`.

## Placement

`placement` controls position and size for visual clips.

```ts
type Placement = {
  x?: number | `${number}%`;
  y?: number | `${number}%`;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  anchor?: Anchor;
  rotation?: number;
  opacity?: number;
};
```

Rules:

- numbers are pixels
- strings are percentages of the timeline dimension
- default anchor is `center`
- default `opacity` is `1`
- default `rotation` is `0`

Supported anchors:

- `top-left`
- `top-center`
- `top-right`
- `center-left`
- `center`
- `center-right`
- `bottom-left`
- `bottom-center`
- `bottom-right`

## Effects

`EffectClip.track` decides scope:

- `track >= 0`: apply after rendering that track
- `track < 0`: apply to the composed frame

Example custom effect:

```ts
import { registerEffectNode } from 'vidio';

registerEffectNode({
  name: 'contrast-pulse',
  getFilter(time, clip) {
    const amount = 1 + Math.sin(time * 4) * Number(clip.params?.amount ?? 0.2);
    return `contrast(${amount})`;
  },
});
```

## React

React helpers are exported from `vidio/react`.

```tsx
import { Preview, useClips, usePlayback, useTimeline } from 'vidio/react';
import { TextClip } from 'vidio';

export function EditorPreview() {
  const timeline = useTimeline({ width: 1280, height: 720, fps: 30 });
  const clips = useClips(timeline);
  const playback = usePlayback(timeline);

  useEffect(() => {
    if (clips.length === 0) {
      timeline.add(new TextClip({
        start: 0,
        duration: 3,
        text: 'Ready',
      }));
    }
  }, [clips.length, timeline]);

  return (
    <div>
      <Preview timeline={timeline} />
      <button onClick={() => playback.play()}>Play</button>
      <button onClick={() => playback.pause()}>Pause</button>
    </div>
  );
}
```

Exports:

- `Preview`
- `PreviewHooks`
- `useTimeline(options)`
- `usePlayback(timeline)`
- `useClips(timeline)`
- `useExport(timeline)`
- `usePreview(timeline, previewOptions?)`

`useExport()` wraps `timeline.export()` with `isExporting`, `progress`, `error`, and `cancel()`.

```tsx
import { useExport, useTimeline } from 'vidio/react';

function ExportButton() {
  const timeline = useTimeline({ width: 1280, height: 720, fps: 30 });
  const { exportVideo, cancel, progress, isExporting } = useExport(timeline);

  return (
    <div>
      <button
        onClick={() => exportVideo({ format: 'mp4', quality: 'high' })}
        disabled={isExporting}
      >
        Export
      </button>
      {isExporting ? (
        <>
          <progress value={progress ?? 0} max={1} />
          <button onClick={cancel}>Cancel</button>
        </>
      ) : null}
    </div>
  );
}
```

## Export

Use `timeline.export()` to encode the current composition in the browser and trigger a download, or `timeline.exportBlob()` to receive the encoded `Blob` without downloading it.

```ts
const result = await timeline.export({
  filename: 'composition.mp4',
  format: 'mp4',
  quality: 'high',
  resolution: { width: 1920 },
  onProgress: (progress) => {
    console.log(`Export: ${Math.round(progress * 100)}%`);
  },
});

console.log(result.blob, result.url, result.stats);
```

Available options:

- `filename?: string`
- `format?: 'mp4' | 'webm'`
- `codec?: 'avc' | 'hevc' | 'vp9' | 'av1'`
- `resolution?: { width?: number; height?: number }`
- `quality?: 'high' | 'balanced' | 'low'`
- `bitrate?: number`
- `fps?: number`
- `hardwareAcceleration?: 'prefer-hardware' | 'prefer-software' | 'no-preference'`
- `audio?: boolean`
- `audioBitrate?: number`
- `signal?: AbortSignal`
- `onProgress?: (progress: number) => void`

Format and codec compatibility:

- `mp4` supports `avc` and `hevc`
- `webm` supports `vp9` and `av1`
- default video codec is `avc` for `mp4` and `vp9` for `webm`
- audio is enabled by default and uses `aac` for `mp4` and `opus` for `webm`

`export()` and `exportBlob()` both resolve to:

```ts
type ExportResult = {
  blob: Blob;
  url: string;
  duration: number;
  stats: {
    totalFrames: number;
    encodingTimeMs: number;
    fileSizeBytes: number;
  };
};
```

Export behavior notes:

- exporting an empty timeline throws an error
- export progress is also emitted through timeline events
- audio export only includes non-muted audio clips with `volume > 0`
- video clips with `audio: true` still contribute audio through their linked companion `AudioClip`
- `export()` creates a download URL and starts a browser download
- `exportBlob()` returns an object URL without downloading; revoke it when finished

## Browser Preview Example

Run the included example:

```bash
npm install
npm run preview
```

Then open `http://localhost:8765`.

See [examples/preview/README.md](/Users/antoniopenapena/Documents/NpmProjects/vidio/examples/preview/README.md) for details.

## Runtime Requirements

This README documents the API currently exported by the package.

Current constraints:

- Sources are `string | URL`
- Preview rendering requires a DOM-enabled browser environment
- `getFrameAt()` depends on `createImageBitmap`
- Export depends on browser support for `VideoEncoder` / `AudioEncoder` (WebCodecs)
- Audio export depends on `OfflineAudioContext`
- Export fetches audio clip sources in the browser; inaccessible URLs will fail
