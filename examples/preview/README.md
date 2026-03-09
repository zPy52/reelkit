# Browser QA Gallery

This example now doubles as the manual QA surface for the renderer and export stack. It serves a
static page that imports the built SDK from `dist/`, mounts the browser preview renderer, and
exposes a Playwright-friendly browser API for automated visual and export checks.

The gallery exercises:

- shared scene fixtures for placement, text, effect scope, duplicate media reuse, and end-frame behavior
- a `<canvas>` compositor in the browser
- hidden HTML media elements for decode and audio playback
- browser-native export via WebCodecs + muxers
- no FFmpeg-backed preview endpoints

## Run

From the repo root:

```bash
npm install
npm run preview
```

Then open `http://localhost:8765`.

## Automated checks

From the repo root:

```bash
npm run test:visual
npm run test:export-qa
```

`test:visual` compares the live preview canvas against committed Chromium goldens in
`tests/browser/qa-gallery.spec.ts-snapshots/`.

`test:export-qa` exports browser-generated videos, loads them back into `<video>`, and compares
selected timestamps against the preview output.

## Demo media

The gallery scenes use:

- `assets/sample-wallpaper.jpg`
- `assets/sample-video.mp4`
- `assets/sample-guy-talking.mp4`
- `assets/sample-audio.mp3`

## Notes

- The server only serves static files from `examples/preview/`, `dist/`, `assets/`, and the
  browser-facing muxer modules under `node_modules/`.
- The React preview surface is exported from `videocanvas/react`.
- Audio playback still depends on the browser allowing media playback after a user gesture.
