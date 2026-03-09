# Browser Preview Example

This example serves a static page that imports the built SDK from `dist/` and composes the local
media in `assets/` directly in the browser.

The preview path uses:

- `Timeline` plus clip classes from the SDK
- a `<canvas>` compositor in the browser
- hidden HTML media elements for decode and audio playback
- no FFmpeg-backed preview endpoints

## Run

From the repo root:

```bash
npm install
npm run preview
```

Then open `http://localhost:8765`.

## Demo media

The page uses:

- `assets/sample-wallpaper.jpg`
- `assets/sample-video.mp4`
- `assets/sample-guy-talking.mp4`
- `assets/sample-audio.mp3`

## Notes

- The server only serves static files from `examples/preview/`, `dist/`, and `assets/`.
- The React preview surface is exported from `videocanvas/react`.
- Audio playback still depends on the browser allowing media playback after a user gesture.
