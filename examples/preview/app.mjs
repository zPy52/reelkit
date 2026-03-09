import {
  AudioClip,
  EffectClip,
  ImageClip,
  TextClip,
  Timeline,
  VideoClip,
} from '/dist/index.mjs';

const previewRoot = document.getElementById('previewRoot');
const playToggle = document.getElementById('playToggle');
const restartButton = document.getElementById('restartButton');
const timelineRange = document.getElementById('timelineRange');
const runtimeSummary = document.getElementById('runtimeSummary');
const playbackStatus = document.getElementById('playbackStatus');
const frameLabel = document.getElementById('frameLabel');
const cueList = document.getElementById('cueList');
const errorBox = document.getElementById('errorBox');

const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });

const cues = [
  { start: 0, duration: 8, label: 'background wallpaper' },
  { start: 0, duration: 8, label: 'hero video plate' },
  { start: 0.6, duration: 7.2, label: 'speaker insert' },
  { start: 0, duration: 3.2, label: 'editorial title' },
  { start: 3.3, duration: 3.8, label: 'feature callout' },
  { start: 0, duration: 3.24, label: 'soundtrack' },
];

cueList.innerHTML = cues.map((cue) => {
  return `
    <li data-start="${cue.start}" data-end="${cue.start + cue.duration}">
      <span class="cue-time">${formatTime(cue.start)} to ${formatTime(cue.start + cue.duration)}</span>
      <strong class="cue-name">${cue.label}</strong>
    </li>
  `;
}).join('');

timeline.add(new ImageClip({
  start: 0,
  duration: 8,
  track: 0,
  src: '/assets/sample-wallpaper.jpg',
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
  src: '/assets/sample-video.mp4',
  audio: false,
  placement: {
    x: '50%',
    y: '54%',
    width: '74%',
    height: '74%',
    anchor: 'center',
  },
}));

timeline.add(new VideoClip({
  start: 0.6,
  duration: 7.2,
  track: 3,
  src: '/assets/sample-guy-talking.mp4',
  audio: false,
  placement: {
    x: '86%',
    y: '82%',
    width: '20%',
    height: '36%',
    anchor: 'center',
    rotation: -1.5,
  },
}));

timeline.add(new TextClip({
  start: 0,
  duration: 3.2,
  track: 4,
  text: 'VIDEOCANVAS\nPreview Stack',
  placement: {
    x: '7%',
    y: '9%',
    anchor: 'top-left',
  },
  style: {
    fontFamily: 'Iowan Old Style, Palatino Linotype, Book Antiqua, serif',
    fontSize: 62,
    fontWeight: 700,
    color: '#fff5ea',
    lineHeight: 0.96,
  },
}));

timeline.add(new TextClip({
  start: 3.3,
  duration: 3.8,
  track: 4,
  text: 'Canvas compositor\nTimeline clock\nReact-ready API',
  placement: {
    x: '7%',
    y: '72%',
    anchor: 'bottom-left',
  },
  style: {
    fontFamily: 'IBM Plex Mono, SFMono-Regular, Menlo, monospace',
    fontSize: 26,
    fontWeight: 500,
    color: '#f7ede1',
    backgroundColor: 'rgba(21, 16, 12, 0.48)',
    padding: 18,
    lineHeight: 1.35,
  },
}));

timeline.add(new AudioClip({
  start: 0,
  duration: 3.24,
  track: 0,
  src: '/assets/sample-audio.mp3',
  volume: 0.8,
}));

timeline.add(new EffectClip({
  start: 0,
  duration: 1.8,
  track: -1,
  effect: 'fade',
  params: { from: 0.28, to: 1 },
}));

timeline.add(new EffectClip({
  start: 0,
  duration: 1.1,
  track: -1,
  effect: 'blur',
  params: { intensity: 2.4 },
}));

const handle = timeline.mountPreview(previewRoot);
timelineRange.max = String(timeline.getDuration());
timelineRange.value = '0';

let isScrubbing = false;

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = 'block';
}

function clearError() {
  errorBox.textContent = '';
  errorBox.style.display = 'none';
}

function formatTime(value) {
  return `${value.toFixed(2)}s`;
}

function updateRuntime(time) {
  runtimeSummary.textContent = `${formatTime(time)} / ${formatTime(timeline.getDuration())}`;
  frameLabel.textContent = `frame ${Math.round(time * timeline.fps)}`;
  playbackStatus.textContent = timeline.playing ? 'playing canvas timeline' : 'paused for scrubbing';

  cueList.querySelectorAll('li').forEach((node) => {
    const start = Number(node.getAttribute('data-start'));
    const end = Number(node.getAttribute('data-end'));
    node.classList.toggle('active', start <= time && time < end);
  });
}

timeline.on('timeupdate', (time) => {
  if (!isScrubbing) {
    timelineRange.value = String(time);
  }
  updateRuntime(time);
});

timeline.on('play', () => {
  playToggle.textContent = 'Pause';
  playbackStatus.textContent = 'playing canvas timeline';
});

timeline.on('pause', () => {
  playToggle.textContent = 'Play';
  playbackStatus.textContent = 'paused for scrubbing';
});

timeline.on('ended', () => {
  playToggle.textContent = 'Play';
  playbackStatus.textContent = 'reached the end of the composition';
});

playToggle.addEventListener('click', async () => {
  clearError();
  try {
    if (timeline.playing) {
      handle.pause();
      return;
    }

    handle.play();
  } catch (error) {
    showError(String(error instanceof Error ? error.message : error));
  }
});

restartButton.addEventListener('click', () => {
  clearError();
  handle.seek(0);
  if (!timeline.playing) {
    updateRuntime(0);
  }
});

timelineRange.addEventListener('pointerdown', () => {
  isScrubbing = true;
});

timelineRange.addEventListener('pointerup', () => {
  isScrubbing = false;
});

timelineRange.addEventListener('input', (event) => {
  clearError();
  const value = Number(event.currentTarget.value);
  handle.seek(value);
});

updateRuntime(0);

window.addEventListener('beforeunload', () => {
  handle.destroy();
  timeline.destroy();
});
