/**
 * Preview server: serves a VidioMedia composition over HTTP so a browser can
 * display frames, scrub, and play/pause. Run from repo root after `npm run build`:
 *
 *   node examples/preview/server.mjs [path/to/video.mp4]
 *
 * If no path is given, uses the built-in demo (wallpaper + center video + PiP with
 * fade-in), requiring assets in repo root: assets/sample-wallpaper.jpg,
 * assets/sample-guy-talking.mp4, assets/sample-video.mp4.
 *
 * Then open http://localhost:8765
 */
import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { promises as fileSystem } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { VidioMedia } from '../../dist/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8765;
const REPO_ROOT = path.resolve(__dirname, '../..');

const DEMO_ASSETS = {
  wallpaper: path.join(REPO_ROOT, 'assets', 'sample-wallpaper.jpg'),
  sampleVideo: path.join(REPO_ROOT, 'assets', 'sample-video.mp4'),
  guyTalking: path.join(REPO_ROOT, 'assets', 'sample-guy-talking.mp4'),
};

const PIP_SEGMENT_DURATION = 5;
const CENTER_VIDEO_SCALE = 0.55;

/** Lower resolution for frame extraction so scrubbing/thumbnails are much faster. */
const PREVIEW_FRAME_OPTIONS = { maxHeight: 360 };

function createDemoMedia() {
  const backgroundTempPath = path.join(os.tmpdir(), `vidio-preview-bg-${randomUUID()}.mp4`);
  const backgroundClip = VidioMedia.factory.fromImage({
    src: DEMO_ASSETS.wallpaper,
    duration: PIP_SEGMENT_DURATION,
  });

  const centerVideoClip = new VidioMedia()
    .setInput(DEMO_ASSETS.sampleVideo)
    .cut({ cuts: [{ from: 0, to: PIP_SEGMENT_DURATION }] })
    .scale(CENTER_VIDEO_SCALE);

  const pipClip = new VidioMedia()
    .setInput(DEMO_ASSETS.guyTalking)
    .cut({ cuts: [{ from: 0, to: PIP_SEGMENT_DURATION }] })
    .crop({ aspectRatio: '1:1', anchor: 'center' })
    .scale(0.25)
    .fadeIn({ from: 0, to: 0.5 });

  return {
    exportBackgroundThenBuild: async () => {
      await backgroundClip.export(backgroundTempPath);
      const media = new VidioMedia()
        .setInput(backgroundTempPath)
        .overlay({
          src: centerVideoClip,
          anchor: 'center',
          x: '50%',
          y: '50%',
          at: 0,
        })
        .overlay({
          src: pipClip,
          anchor: 'bottom-right',
          x: '92%',
          y: '92%',
          at: 0,
        });
      return { media, backgroundTempPath };
    },
  };
}

const videoPath = process.argv[2];
let media;
let demoBackgroundTempPath = null;

if (videoPath) {
  media = new VidioMedia({ input: videoPath });
} else {
  const required = [
    ['sample-wallpaper.jpg', DEMO_ASSETS.wallpaper],
    ['sample-video.mp4', DEMO_ASSETS.sampleVideo],
    ['sample-guy-talking.mp4', DEMO_ASSETS.guyTalking],
  ];
  for (const [name, filePath] of required) {
    try {
      const stat = await fileSystem.stat(filePath);
      if (!stat.isFile()) throw new Error('not a file');
    } catch (err) {
      console.error(
        `Demo mode requires asset "${name}" at ${filePath}. Add it to assets/ or run with a video path.`,
      );
      process.exit(1);
    }
  }
  const demo = createDemoMedia();
  let resolved = null;
  let resolveTask = null;

  async function ensureResolvedDemo() {
    if (resolved) {
      return resolved;
    }
    if (resolveTask) {
      return resolveTask;
    }

    resolveTask = (async () => {
      const value = await demo.exportBackgroundThenBuild();
      resolved = value;
      demoBackgroundTempPath = value.backgroundTempPath;
      return value;
    })();

    try {
      return await resolveTask;
    } catch (error) {
      resolveTask = null;
      throw error;
    }
  }

  media = {
    preview: {
      async metadata() {
        const demoState = await ensureResolvedDemo();
        return demoState.media.preview.metadata();
      },
      async frame(seconds, options) {
        const demoState = await ensureResolvedDemo();
        return demoState.media.preview.frame(seconds, options ?? PREVIEW_FRAME_OPTIONS);
      },
      async exportSegment(options) {
        const demoState = await ensureResolvedDemo();
        return demoState.media.preview.exportSegment(options);
      },
    },
  };
}

let meta = null;
let metaTask = null;
let playbackSegmentPath = null;
let playbackSegmentTask = null;

async function getMetadata() {
  if (meta) return meta;
  if (metaTask) return metaTask;

  metaTask = (async () => {
    const value = await media.preview.metadata();
    meta = value;
    return value;
  })();

  try {
    return await metaTask;
  } finally {
    metaTask = null;
  }
}

async function getPlaybackSegmentPath() {
  if (playbackSegmentPath) return playbackSegmentPath;
  if (playbackSegmentTask) return playbackSegmentTask;

  playbackSegmentTask = (async () => {
    const data = await getMetadata();
    const outputPath = await media.preview.exportSegment({
      from: 0,
      duration: data.duration,
      quality: 'low',
    });
    playbackSegmentPath = outputPath;
    return outputPath;
  })();

  try {
    return await playbackSegmentTask;
  } finally {
    playbackSegmentTask = null;
  }
}

function toRangeStartEnd(rangeHeader, totalSize) {
  if (!rangeHeader?.startsWith('bytes=')) return null;
  const [startRaw, endRaw] = rangeHeader.replace('bytes=', '').split('-');
  const start = Number.parseInt(startRaw, 10);
  const end = endRaw ? Number.parseInt(endRaw, 10) : totalSize - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= totalSize) return null;
  return {
    start,
    end: Math.min(end, totalSize - 1),
  };
}

async function serveByteRangeVideo(req, res, filePath) {
  const stats = await fileSystem.stat(filePath);
  const totalSize = stats.size;
  const range = toRangeStartEnd(req.headers.range, totalSize);

  if (!range) {
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': String(totalSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
    return;
  }

  const chunkSize = range.end - range.start + 1;
  res.writeHead(206, {
    'Content-Type': 'video/mp4',
    'Content-Length': String(chunkSize),
    'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (url.pathname === '/api/metadata') {
    try {
      const data = await getMetadata();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err?.message ?? err) }));
    }
    return;
  }

  if (url.pathname === '/api/frame') {
    const t = parseFloat(url.searchParams.get('t') ?? '0');
    if (!Number.isFinite(t) || t < 0) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad request: t must be a non-negative number');
      return;
    }
    try {
      const buffer = await media.preview.frame(t, PREVIEW_FRAME_OPTIONS);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      });
      res.end(buffer);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(String(err?.message ?? err));
    }
    return;
  }

  if (url.pathname === '/api/playback') {
    try {
      const segmentPath = await getPlaybackSegmentPath();
      await serveByteRangeVideo(req, res, segmentPath);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(String(err?.message ?? err));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Preview server: http://localhost:${PORT}`);
  if (videoPath) {
    console.log(`Video: ${videoPath}`);
  } else {
    console.log('Demo: wallpaper + center video + PiP with fade-in (assets from repo assets/)');
    // Pre-build the playback segment so the first page load gets it without waiting
    void getPlaybackSegmentPath().catch((err) => {
      console.error('Demo pre-warm failed:', err?.message ?? err);
    });
  }
});

async function cleanupPlaybackSegment() {
  if (playbackSegmentPath) {
    const pathToDelete = playbackSegmentPath;
    playbackSegmentPath = null;
    await fileSystem.unlink(pathToDelete).catch(() => undefined);
  }
  if (demoBackgroundTempPath) {
    const pathToDelete = demoBackgroundTempPath;
    demoBackgroundTempPath = null;
    await fileSystem.unlink(pathToDelete).catch(() => undefined);
  }
}

process.on('SIGINT', async () => {
  await cleanupPlaybackSegment();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanupPlaybackSegment();
  process.exit(0);
});
