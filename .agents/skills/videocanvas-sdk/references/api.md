# VideoCanvas API Reference

## Package Surface

Primary entrypoint:

```ts
import {
  Timeline,
  VideoClip,
  ImageClip,
  AudioClip,
  TextClip,
  EffectClip,
  registerEffectNode,
  getEffectNode,
} from 'videocanvas';
```

React entrypoint:

```ts
import {
  Preview,
  PreviewHooks,
  useTimeline,
  usePlayback,
  useClips,
  usePreview,
} from 'videocanvas/react';
```

## Timeline

```ts
new Timeline({
  width: number,
  height: number,
  fps?: number,
});
```

State:

- `width`
- `height`
- `fps`
- `currentTime`
- `playing`

Methods:

- `add(clip): this`
- `remove(clipOrId): this`
- `getClip(id): Clip | undefined`
- `getClips(): readonly Clip[]`
- `updateClip(id, patch): this`
- `getDuration(): number`
- `setResolution(width, height): this`
- `play(startTime?): void`
- `pause(): void`
- `seek(time): void`
- `mountPreview(container, previewOptions?): PreviewHandle`
- `getFrameAt(time): Promise<ImageBitmap>`
- `previewFrames({ range, fps?, signal?, onFrame }): () => void`
- `destroy(): void`

Events:

- `clip-added`
- `clip-removed`
- `clip-changed`
- `resolution-changed`
- `timeupdate`
- `play`
- `pause`
- `ended`

## Clip Constructors

Shared base options:

```ts
{
  id?: string;
  start: number;
  duration: number;
  in?: number;
  out?: number;
  track?: number;
}
```

### VideoClip

```ts
new VideoClip({
  src: string | URL,
  start: number,
  duration: number,
  in?: number,
  out?: number,
  track?: number,
  placement?: Placement,
  audio?: boolean,
  muted?: boolean,
  volume?: number,
});
```

Notes:

- defaults: `audio: true`, `muted: false`, `volume: 1`
- adding a video with `audio: true` creates a linked `AudioClip`

### ImageClip

```ts
new ImageClip({
  src: string | URL,
  start: number,
  duration: number,
  in?: number,
  out?: number,
  track?: number,
  placement?: Placement,
});
```

### AudioClip

```ts
new AudioClip({
  src: string | URL,
  start: number,
  duration: number,
  in?: number,
  out?: number,
  track?: number,
  volume?: number,
  muted?: boolean,
  mediaTag?: 'audio' | 'video',
  linkedClipId?: string,
});
```

### TextClip

```ts
new TextClip({
  text: string,
  start: number,
  duration: number,
  in?: number,
  out?: number,
  track?: number,
  placement?: Placement,
  style?: TextStyle,
});
```

Default text style values:

- `fontFamily: 'Georgia, Baskerville, serif'`
- `fontSize: 48`
- `fontWeight: 600`
- `lineHeight: 1.2`
- `color: '#ffffff'`
- `align: 'left'`
- `padding: 0`
- `letterSpacing: 0`

### EffectClip

```ts
new EffectClip({
  effect: string,
  start: number,
  duration: number,
  in?: number,
  out?: number,
  track?: number,
  params?: Record<string, unknown>,
});
```

## Placement

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

Anchors:

- `top-left`
- `top-center`
- `top-right`
- `center-left`
- `center`
- `center-right`
- `bottom-left`
- `bottom-center`
- `bottom-right`

Defaults for visual clips:

- `x: '50%'`
- `y: '50%'`
- `anchor: 'center'`
- `opacity: 1`
- `rotation: 0`

Rules:

- numeric dimensions are pixels
- string dimensions are percentages of timeline width or height

## Preview

```ts
const handle = timeline.mountPreview(container, {
  width?: number,
  height?: number,
  pixelRatio?: number,
});
```

`PreviewHandle`:

- `canvas`
- `destroy()`
- `play(startTime?)`
- `pause()`
- `seek(time)`

## Effects

Built-in registry entries:

- `fade`
- `blur`

Register custom effects:

```ts
registerEffectNode({
  name: 'custom-effect',
  getFilter(time, clip) {
    return 'grayscale(0.4)';
  },
});
```

Scope:

- `track >= 0`: effect applies after drawing that track
- `track < 0`: effect applies to the final composed frame

## React Helpers

`useTimeline(options)` returns a stable `Timeline` instance.

`usePlayback(timeline)` returns:

- `currentTime`
- `isPlaying`
- `play(startTime?)`
- `pause()`
- `seek(time)`

`useClips(timeline)` returns the current `readonly Clip[]`.

`usePreview(timeline, previewOptions?)` returns playback controls plus `ref`.

`Preview` mounts a responsive container-backed preview canvas for a timeline.

## Example

```tsx
const timeline = useTimeline({ width: 1280, height: 720, fps: 30 });
const { isPlaying, play, pause } = usePlayback(timeline);

useEffect(() => {
  timeline.add(new TextClip({
    start: 0,
    duration: 2,
    text: 'Hello VideoCanvas',
  }));
}, [timeline]);

return (
  <>
    <Preview timeline={timeline} />
    <button onClick={() => isPlaying ? pause() : play()}>
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  </>
);
```
