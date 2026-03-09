import {
  AudioClip,
  EffectClip,
  ImageClip,
  TextClip,
  Timeline,
  VideoClip,
} from '/dist/index.mjs';
import {
  DEFAULT_RESOLUTION_ID,
  DEFAULT_SCENE_ID,
  RESOLUTION_PRESETS,
  buildScene,
  listScenes,
} from './scene-catalog.mjs';

const sdk = {
  AudioClip,
  EffectClip,
  ImageClip,
  TextClip,
  Timeline,
  VideoClip,
};

const previewRoot = document.getElementById('previewRoot');
const sceneList = document.getElementById('sceneList');
const sceneDescription = document.getElementById('sceneDescription');
const resolutionList = document.getElementById('resolutionList');
const timestampList = document.getElementById('timestampList');
const playToggle = document.getElementById('playToggle');
const restartButton = document.getElementById('restartButton');
const timelineRange = document.getElementById('timelineRange');
const runtimeSummary = document.getElementById('runtimeSummary');
const playbackStatus = document.getElementById('playbackStatus');
const exportMp4Button = document.getElementById('exportMp4Button');
const exportWebmButton = document.getElementById('exportWebmButton');
const exportLog = document.getElementById('exportLog');
const errorBox = document.getElementById('errorBox');
const metaScene = document.getElementById('metaScene');
const metaResolution = document.getElementById('metaResolution');
const metaDuration = document.getElementById('metaDuration');
const metaFrame = document.getElementById('metaFrame');
const metaStatus = document.getElementById('metaStatus');
const metaExport = document.getElementById('metaExport');

const url = new URL(window.location.href);
const initialSceneId = url.searchParams.get('scene') ?? DEFAULT_SCENE_ID;
const initialResolutionId = url.searchParams.get('resolution') ?? DEFAULT_RESOLUTION_ID;

const captureCanvas = document.createElement('canvas');
const captureContext = captureCanvas.getContext('2d', { willReadFrequently: true });

if (!captureContext) {
  throw new Error('Unable to create a capture canvas for QA diagnostics.');
}

const state = {
  currentSceneId: initialSceneId,
  currentResolutionId: initialResolutionId,
  handle: null,
  scene: null,
  timeline: null,
  resolution: null,
  unsubscribers: [],
  exportStatus: 'idle',
};

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextAnimationFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

async function settlePreview(waitMs = 90) {
  await nextAnimationFrame();
  await nextAnimationFrame();
  await wait(waitMs);
}

function formatTime(value) {
  return `${value.toFixed(2)}s`;
}

function getPreviewCanvas() {
  return previewRoot.querySelector('canvas');
}

function setError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = '';
  errorBox.hidden = true;
}

function setExportLog(message) {
  exportLog.textContent = message;
}

function getStateSnapshot() {
  if (!state.timeline || !state.scene || !state.resolution) {
    return null;
  }

  return {
    sceneId: state.currentSceneId,
    resolutionId: state.currentResolutionId,
    currentTime: state.timeline.currentTime,
    duration: state.timeline.getDuration(),
    width: state.timeline.width,
    height: state.timeline.height,
    playing: state.timeline.playing,
    sceneTitle: state.scene.title,
  };
}

function updateDiagnostics() {
  if (!state.timeline || !state.scene || !state.resolution) {
    return;
  }

  metaScene.textContent = `${state.scene.title} (${state.scene.id})`;
  metaResolution.textContent = `${state.resolution.width} x ${state.resolution.height}`;
  metaDuration.textContent = formatTime(state.timeline.getDuration());
  metaFrame.textContent = String(Math.round(state.timeline.currentTime * state.timeline.fps));
  metaStatus.textContent = state.timeline.playing ? 'playing' : 'paused';
  metaExport.textContent = state.exportStatus;
}

function updateTransportSummary(time = state.timeline?.currentTime ?? 0) {
  if (!state.timeline) {
    return;
  }

  runtimeSummary.textContent = `${formatTime(time)} / ${formatTime(state.timeline.getDuration())}`;
  playbackStatus.textContent = state.timeline.playing
    ? 'playing preview timeline'
    : 'paused for QA scrubbing';
  timelineRange.value = String(time);
  timelineRange.max = String(state.timeline.getDuration());
  updateDiagnostics();
}

function updateTransportButtons() {
  playToggle.textContent = state.timeline?.playing ? 'Pause' : 'Play';
}

function cleanupScene() {
  for (const unsubscribe of state.unsubscribers) {
    unsubscribe();
  }

  state.unsubscribers = [];
  state.handle?.destroy();
  state.timeline?.destroy();
  state.handle = null;
  state.timeline = null;
  state.scene = null;
  state.resolution = null;
}

function renderSceneButtons() {
  const scenes = listScenes();
  sceneList.innerHTML = scenes.map((scene) => {
    const active = scene.id === state.currentSceneId;
    return `
      <button
        class="chip chip-block${active ? ' active' : ''}"
        data-scene-id="${scene.id}"
        type="button"
      >
        <strong>${scene.title}</strong>
        <span>${scene.description}</span>
      </button>
    `;
  }).join('');

  sceneList.querySelectorAll('[data-scene-id]').forEach((button) => {
    button.addEventListener('click', () => {
      void mountScene(button.getAttribute('data-scene-id') ?? state.currentSceneId, state.currentResolutionId);
    });
  });
}

function renderResolutionButtons() {
  resolutionList.innerHTML = RESOLUTION_PRESETS.map((preset) => {
    const active = preset.id === state.currentResolutionId;
    return `
      <button
        class="chip${active ? ' active' : ''}"
        data-resolution-id="${preset.id}"
        type="button"
      >
        ${preset.label}
      </button>
    `;
  }).join('');

  resolutionList.querySelectorAll('[data-resolution-id]').forEach((button) => {
    button.addEventListener('click', () => {
      void mountScene(state.currentSceneId, button.getAttribute('data-resolution-id') ?? state.currentResolutionId);
    });
  });
}

function renderTimestampButtons() {
  if (!state.scene) {
    timestampList.innerHTML = '';
    return;
  }

  timestampList.innerHTML = state.scene.timestamps.map((time) => {
    return `
      <button class="chip" data-timestamp="${time}" type="button">${formatTime(time)}</button>
    `;
  }).join('');

  timestampList.querySelectorAll('[data-timestamp]').forEach((button) => {
    button.addEventListener('click', () => {
      const time = Number(button.getAttribute('data-timestamp'));
      void seekPreview(time);
    });
  });
}

function attachTimelineListeners() {
  if (!state.timeline) {
    return;
  }

  state.unsubscribers.push(
    state.timeline.on('timeupdate', (time) => {
      updateTransportSummary(time);
    }),
    state.timeline.on('play', () => {
      updateTransportButtons();
      updateTransportSummary(state.timeline.currentTime);
    }),
    state.timeline.on('pause', () => {
      updateTransportButtons();
      updateTransportSummary(state.timeline.currentTime);
    }),
    state.timeline.on('ended', () => {
      updateTransportButtons();
      playbackStatus.textContent = 'reached the end of the composition';
      updateDiagnostics();
    }),
  );
}

async function mountScene(sceneId = state.currentSceneId, resolutionId = state.currentResolutionId) {
  clearError();
  cleanupScene();

  const { scene, resolution, timeline } = buildScene({
    sdk,
    sceneId,
    resolutionId,
  });

  const handle = timeline.mountPreview(previewRoot);

  state.currentSceneId = scene.id;
  state.currentResolutionId = resolution.id;
  state.scene = scene;
  state.resolution = resolution;
  state.timeline = timeline;
  state.handle = handle;
  state.exportStatus = 'idle';

  sceneDescription.textContent = scene.description;
  renderSceneButtons();
  renderResolutionButtons();
  renderTimestampButtons();
  attachTimelineListeners();
  updateTransportButtons();
  updateTransportSummary(0);
  setExportLog('Ready for preview, frame capture, and browser export.');

  url.searchParams.set('scene', state.currentSceneId);
  url.searchParams.set('resolution', state.currentResolutionId);
  window.history.replaceState({}, '', url);

  await settlePreview();
  return getStateSnapshot();
}

async function seekPreview(time) {
  if (!state.handle || !state.timeline) {
    return null;
  }

  clearError();
  state.handle.seek(time);
  await settlePreview();
  updateTransportSummary(state.timeline.currentTime);
  return getStateSnapshot();
}

function getSourceDimensions(source) {
  if ('videoWidth' in source && 'videoHeight' in source) {
    return {
      width: source.videoWidth,
      height: source.videoHeight,
    };
  }

  return {
    width: source.width,
    height: source.height,
  };
}

function captureCanvasImageData(source, width, height) {
  captureCanvas.width = width;
  captureCanvas.height = height;
  captureContext.clearRect(0, 0, width, height);
  const sourceDimensions = getSourceDimensions(source);
  captureContext.drawImage(
    source,
    0,
    0,
    sourceDimensions.width,
    sourceDimensions.height,
    0,
    0,
    width,
    height,
  );
  return captureContext.getImageData(0, 0, width, height);
}

async function capturePreviewImageData(time) {
  if (!state.timeline) {
    throw new Error('Timeline is not mounted.');
  }

  await seekPreview(time);
  const canvas = getPreviewCanvas();
  if (!canvas) {
    throw new Error('Preview canvas is not mounted.');
  }

  return captureCanvasImageData(canvas, state.timeline.width, state.timeline.height);
}

async function loadBlobVideo(blob) {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  await new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Unable to decode exported video in the browser.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });

  return {
    url,
    video,
    dispose() {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    },
  };
}

async function seekMediaElement(element, time) {
  const duration = Number.isFinite(element.duration) && element.duration > 0
    ? Math.max(0, element.duration - 0.001)
    : Math.max(0, time);
  const nextTime = Math.max(0, Math.min(time, duration));

  await new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Unable to seek the media element.'));
    };
    const cleanup = () => {
      element.removeEventListener('seeked', onSeeked);
      element.removeEventListener('error', onError);
    };

    element.addEventListener('seeked', onSeeked, { once: true });
    element.addEventListener('error', onError, { once: true });
    element.currentTime = nextTime;
  });
}

function compareImageData(left, right) {
  let totalDiff = 0;
  let maxChannelDiff = 0;
  const channelCount = Math.min(left.data.length, right.data.length);

  for (let index = 0; index < channelCount; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const diff = Math.abs(left.data[index + channel] - right.data[index + channel]);
      totalDiff += diff;
      maxChannelDiff = Math.max(maxChannelDiff, diff);
    }
  }

  const sampleCount = Math.max(1, (channelCount / 4) * 3);
  return {
    meanAbsDiff: totalDiff / sampleCount,
    maxChannelDiff,
  };
}

async function compareExportFrames(blob, times) {
  if (!state.timeline) {
    throw new Error('Timeline is not mounted.');
  }

  const exportVideo = await loadBlobVideo(blob);
  try {
    const frames = [];

    for (const time of times) {
      const previewFrame = await capturePreviewImageData(time);
      await seekMediaElement(exportVideo.video, time);
      const exportedFrame = captureCanvasImageData(
        exportVideo.video,
        state.timeline.width,
        state.timeline.height,
      );

      frames.push({
        time,
        ...compareImageData(previewFrame, exportedFrame),
      });
    }

    return frames;
  } finally {
    exportVideo.dispose();
  }
}

async function runExport(options = {}) {
  if (!state.timeline || !state.scene) {
    throw new Error('Timeline is not mounted.');
  }

  clearError();
  state.exportStatus = `exporting ${options.format ?? 'mp4'}...`;
  updateDiagnostics();
  exportMp4Button.disabled = true;
  exportWebmButton.disabled = true;

  const progress = [];
  const controller = new AbortController();
  let didAbort = false;

  try {
    const result = await state.timeline.exportBlob({
      format: options.format ?? 'mp4',
      audio: options.audio ?? true,
      signal: controller.signal,
      onProgress(value) {
        progress.push(value);
        state.exportStatus = `${options.format ?? 'mp4'} ${(value * 100).toFixed(0)}%`;
        updateDiagnostics();

        if (!didAbort && typeof options.abortAtProgress === 'number' && value >= options.abortAtProgress) {
          didAbort = true;
          controller.abort();
        }
      },
    });

    const summary = {
      ok: true,
      progress,
      size: result.blob.size,
      type: result.blob.type,
      duration: result.duration,
    };

    if (options.compareFrames) {
      summary.frames = await compareExportFrames(
        result.blob,
        options.times ?? state.scene.timestamps,
      );
    }

    state.exportStatus = `ready (${result.blob.type}, ${result.blob.size} bytes)`;
    updateDiagnostics();
    setExportLog(`Export complete: ${result.blob.type}, ${result.blob.size} bytes.`);
    return summary;
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    state.exportStatus = `${normalized.name}: ${normalized.message}`;
    updateDiagnostics();
    setExportLog(`Export failed: ${normalized.message}`);
    return {
      ok: false,
      progress,
      error: {
        name: normalized.name,
        message: normalized.message,
      },
    };
  } finally {
    exportMp4Button.disabled = false;
    exportWebmButton.disabled = false;
  }
}

playToggle.addEventListener('click', async () => {
  if (!state.handle || !state.timeline) {
    return;
  }

  clearError();

  try {
    if (state.timeline.playing) {
      state.handle.pause();
      return;
    }

    state.handle.play();
  } catch (error) {
    setError(String(error instanceof Error ? error.message : error));
  }
});

restartButton.addEventListener('click', () => {
  if (!state.handle) {
    return;
  }

  clearError();
  void seekPreview(0);
});

timelineRange.addEventListener('input', (event) => {
  const time = Number(event.currentTarget.value);
  void seekPreview(time);
});

exportMp4Button.addEventListener('click', async () => {
  const result = await runExport({ format: 'mp4' });
  if (!result.ok) {
    setError(result.error.message);
  }
});

exportWebmButton.addEventListener('click', async () => {
  const result = await runExport({ format: 'webm' });
  if (!result.ok) {
    setError(result.error.message);
  }
});

const readyPromise = mountScene(initialSceneId, initialResolutionId);

window.__videocanvasQA__ = {
  whenReady: () => readyPromise,
  getState: () => getStateSnapshot(),
  listScenes: () => listScenes(),
  listResolutions: () => RESOLUTION_PRESETS,
  setScene: async (sceneId) => {
    return mountScene(sceneId, state.currentResolutionId);
  },
  setResolution: async (resolutionId) => {
    return mountScene(state.currentSceneId, resolutionId);
  },
  seek: async (time) => {
    return seekPreview(time);
  },
  play: async () => {
    state.handle?.play();
    await settlePreview(120);
    return getStateSnapshot();
  },
  pause: async () => {
    state.handle?.pause();
    await settlePreview();
    return getStateSnapshot();
  },
  runExport: async (options) => {
    return runExport(options);
  },
};

window.addEventListener('beforeunload', () => {
  cleanupScene();
});
