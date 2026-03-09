# videocanvas

`videocanvas` is a TypeScript SDK for building timeline-based video compositions and previewing them in the browser with a canvas renderer.

The current SDK surface covers:

- Timeline state and playback control
- Video, image, audio, text, and effect clips
- DOM canvas preview mounting
- Offscreen frame capture with `getFrameAt()`
- React helpers from `videocanvas/react`

## Installation

```bash
npm install videocanvas
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
} from 'videocanvas';

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
  text: 'VideoCanvas',
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
import { registerEffectNode } from 'videocanvas';

registerEffectNode({
  name: 'contrast-pulse',
  getFilter(time, clip) {
    const amount = 1 + Math.sin(time * 4) * Number(clip.params?.amount ?? 0.2);
    return `contrast(${amount})`;
  },
});
```

## React

React helpers are exported from `videocanvas/react`.

```tsx
import { Preview, useClips, usePlayback, useTimeline } from 'videocanvas/react';
import { TextClip } from 'videocanvas';

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
- `usePreview(timeline, previewOptions?)`

## Browser Preview Example

Run the included example:

```bash
npm install
npm run preview
```

Then open `http://localhost:8765`.

See [examples/preview/README.md](/Users/antoniopenapena/Documents/NpmProjects/videocanvas/examples/preview/README.md) for details.

## Current Scope

This README documents the API currently exported by the package.

Current constraints:

- Sources are `string | URL`
- Preview rendering requires a DOM-enabled browser environment
- `getFrameAt()` depends on `createImageBitmap`
- The public SDK does not currently expose a file export API such as MP4 rendering
