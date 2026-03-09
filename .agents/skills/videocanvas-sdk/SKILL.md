---
name: videocanvas-sdk
description: "Use this skill when working with the videocanvas TypeScript SDK in this repository: building or editing timelines, adding video/image/audio/text/effect clips, mounting browser previews, capturing frames, or using the React entrypoint from `videocanvas/react`. Also use it when documenting the SDK or generating examples so the output matches the current exported API instead of older plan documents."
---

# VideoCanvas SDK

## Overview

Use the current source as the authority. Start with `src/index.ts`, `src/react/index.ts`, and `README.md`. Ignore older planning docs when they describe APIs that are not exported.

## Workflow

1. Confirm the public surface in `src/index.ts` and `src/react/index.ts`.
2. Match examples to the real clip constructors and timeline methods.
3. Prefer the browser preview flow:
   - create `Timeline`
   - add clips
   - call `mountPreview()` or use `Preview` / hooks
4. Preserve current behavior around video audio companions:
   - `VideoClip` defaults to `audio: true`
   - `timeline.add(videoClip)` creates a linked `AudioClip`
   - set `audio: false` when a video should stay silent
5. State current limitations explicitly if the task touches rendering/export.

## Public API

Package entrypoint exports:

- `Timeline`
- `AudioClip`
- `BaseClip`
- `EffectClip`
- `ImageClip`
- `TextClip`
- `VideoClip`
- `getEffectNode`
- `registerEffectNode`
- types from clips, timeline, effect nodes, and preview renderer

React entrypoint exports:

- `Preview`
- `PreviewHooks`
- `useTimeline`
- `usePlayback`
- `useClips`
- `useExport`
- `usePreview`

Read [references/api.md](references/api.md) when you need constructor signatures, events, placement rules, or React usage.

## Implementation Notes

- Treat `track` as the layer/audio lane index. Lower tracks render first.
- Use `track < 0` on `EffectClip` for composition-wide effects.
- Use `string` percentages like `'50%'` for relative placement and `number` for pixels.
- `Source` is currently `string | URL`. Do not claim support for buffers or uploads unless you add it to the code.
- `mountPreview()` and the React preview APIs require a DOM environment.
- `getFrameAt()` requires `createImageBitmap`.
- `timeline.export()` and `timeline.exportBlob()` are part of the public API.
- Export supports `mp4` (`avc`, `hevc`) and `webm` (`vp9`, `av1`).
- Export relies on browser WebCodecs and `OfflineAudioContext`; document those requirements when relevant.
- Built-in effects are only `fade` and `blur` unless more are registered.

## Guidance For Common Tasks

### Build a composition

- Instantiate `Timeline({ width, height, fps? })`.
- Add clips with explicit `start`, `duration`, and `track`.
- Use `TextClip` or `ImageClip` for overlays.
- Add `EffectClip` last if the task needs fades or blur.

### Update an editor UI

- Listen to timeline events or use the React hooks.
- Use `timeline.updateClip(id, patch)` for non-destructive edits.
- Use `timeline.getClips()` as the canonical ordered clip list.

### Document or explain the SDK

- Prefer short examples that mirror `examples/preview/app.mjs`.
- Mention the automatic audio companion behavior for videos.
- Document `timeline.export()` / `timeline.exportBlob()` when the task touches delivery or downloads.
- Mention that `useExport()` is available from `videocanvas/react` for React UIs.

## References

- [references/api.md](references/api.md): API summary and examples
- [README.md](/Users/antoniopenapena/Documents/NpmProjects/videocanvas/README.md): user-facing SDK documentation
- [examples/preview/app.mjs](/Users/antoniopenapena/Documents/NpmProjects/videocanvas/examples/preview/app.mjs): end-to-end browser composition example
