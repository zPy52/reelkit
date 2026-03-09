# Preview example (vanilla JS)

A small Node server plus HTML page to preview a `VidioMedia` composition in the browser: play, pause, and scrub with a slider.

## Run

From the **repo root** (after building the SDK):

```bash
npm run build
node examples/preview/server.mjs [path/to/video.mp4]
```

- **With no path**: Uses the built-in **demo** (same as `demo-wallpaper-pip-fade.mp4`): wallpaper background, centered main video, and a PiP (guy talking) with fade-in. Requires these assets in `assets/`:
  - `sample-wallpaper.jpg`
  - `sample-video.mp4`
  - `sample-guy-talking.mp4`
  The server pre-builds the preview segment at startup so the first load is usually quick; if you open the page immediately, you may see "Loading…" for a few seconds while the segment is encoded.
- **With a path**: Previews that single video file.

Then open **http://localhost:8765** in a browser.

## What it does

- **Server** (`server.mjs`): Builds a `VidioMedia` (from the demo composition or the file you pass), serves the HTML page, and exposes:
  - `GET /api/metadata` → `{ duration, width, height, fps }`
  - `GET /api/frame?t=<seconds>` → PNG image for that time (low-res, max height 360px, for fast extraction)
  - `GET /api/playback` → range-enabled MP4 stream generated with `preview.exportSegment(...)`
- **Page** (`index.html`): Vanilla JS that plays `/api/playback` in a `<video>` element and wires custom play/pause/seek controls for smooth playback.

Use demo mode to verify on-the-fly filters (fade-in, overlays, etc.) in the preview. You can edit `server.mjs` to change the composition (e.g. add blur or zoom) and the preview will reflect it.
