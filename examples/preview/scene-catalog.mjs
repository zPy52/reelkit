export const QA_FONT_MONO = '"Courier New", Courier, monospace';
export const QA_FONT_SERIF = 'Georgia, "Times New Roman", serif';

export const RESOLUTION_PRESETS = [
  { id: '360p', label: '640 x 360', width: 640, height: 360 },
  { id: '540p', label: '960 x 540', width: 960, height: 540 },
  { id: '720p', label: '1280 x 720', width: 1280, height: 720 },
];

export const DEFAULT_RESOLUTION_ID = '720p';
export const DEFAULT_SCENE_ID = 'anchor-grid';

const ASSETS = {
  audio: '/assets/sample-audio.mp3',
  talkingVideo: '/assets/sample-guy-talking.mp4',
  wallpaper: '/assets/sample-wallpaper.jpg',
  wideVideo: '/assets/sample-video.mp4',
};

function svgDataUrl(markup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function createBackdrop(primary, secondary, accent) {
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
        <radialGradient id="glow" cx="18%" cy="15%" r="70%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.58" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#wash)" />
      <rect width="1600" height="900" fill="url(#glow)" />
      <g stroke="rgba(255,255,255,0.12)" stroke-width="1">
        <path d="M0 140h1600M0 320h1600M0 520h1600M0 700h1600" />
        <path d="M180 0v900M480 0v900M820 0v900M1180 0v900M1440 0v900" />
      </g>
    </svg>
  `);
}

function createStripedCard(primary, secondary, accent) {
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
      <defs>
        <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
      </defs>
      <rect width="960" height="720" rx="40" fill="url(#card)" />
      <g opacity="0.55">
        <path d="M-120 90L220 -80L1060 360L720 530Z" fill="${accent}" />
        <path d="M-60 360L280 190L1120 630L780 800Z" fill="rgba(255,255,255,0.36)" />
        <path d="M120 660L460 490L1280 920L940 1090Z" fill="rgba(18,18,18,0.18)" />
      </g>
    </svg>
  `);
}

function addBackground(timeline, ImageClip, duration, src) {
  timeline.add(new ImageClip({
    start: 0,
    duration,
    track: 0,
    src,
    placement: {
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      anchor: 'center',
    },
  }));
}

const SCENES = [
  {
    id: 'anchor-grid',
    title: 'Anchor Grid',
    description: 'Placement anchors, pixel coordinates, percent coordinates, rotation, and opacity.',
    duration: 4,
    timestamps: [0, 1.2, 3.8],
    build({ timeline, sdk }) {
      const { ImageClip, TextClip } = sdk;
      addBackground(timeline, ImageClip, 4, createBackdrop('#20161d', '#46303e', '#f08d49'));

      const labels = [
        ['TL', 'top-left', '8%', '10%'],
        ['TC', 'top-center', '50%', '9%'],
        ['TR', 'top-right', '92%', '10%'],
        ['CL', 'center-left', '7%', '50%'],
        ['C', 'center', '50%', '50%'],
        ['CR', 'center-right', '93%', '50%'],
        ['BL', 'bottom-left', '8%', '90%'],
        ['BC', 'bottom-center', '50%', '91%'],
        ['BR', 'bottom-right', '92%', '90%'],
      ];

      for (const [label, anchor, x, y] of labels) {
        timeline.add(new TextClip({
          start: 0,
          duration: 4,
          track: 2,
          text: label,
          placement: {
            x,
            y,
            anchor,
            rotation: label === 'C' ? 8 : 0,
            opacity: label === 'C' ? 0.82 : 1,
          },
          style: {
            fontFamily: QA_FONT_MONO,
            fontSize: label === 'C' ? 48 : 28,
            fontWeight: 700,
            color: '#fff7ef',
            backgroundColor: 'rgba(16, 10, 15, 0.42)',
            padding: label === 'C' ? 16 : 10,
            align: 'left',
          },
        }));
      }

      timeline.add(new TextClip({
        start: 0,
        duration: 4,
        track: 3,
        text: 'pixel pin',
        placement: { x: 130, y: 160, anchor: 'center-left' },
        style: {
          fontFamily: QA_FONT_MONO,
          fontSize: 22,
          color: '#ffd9c0',
          backgroundColor: 'rgba(240, 141, 73, 0.18)',
          padding: 8,
        },
      }));
    },
  },
  {
    id: 'text-lab',
    title: 'Text Lab',
    description: 'Multiline layout, background fills, left/center/right align, and non-zero letter spacing.',
    duration: 4,
    timestamps: [0, 1.6, 3.6],
    build({ timeline, sdk }) {
      const { ImageClip, TextClip } = sdk;
      addBackground(timeline, ImageClip, 4, createBackdrop('#13232a', '#34515b', '#74d0c5'));

      timeline.add(new TextClip({
        start: 0,
        duration: 4,
        track: 1,
        text: 'LEFT EDGE\npadded block',
        placement: { x: '8%', y: '16%', anchor: 'top-left' },
        style: {
          fontFamily: QA_FONT_MONO,
          fontSize: 28,
          fontWeight: 700,
          color: '#f3fbff',
          backgroundColor: 'rgba(9, 17, 20, 0.44)',
          padding: 14,
          lineHeight: 1.18,
          align: 'left',
        },
      }));

      timeline.add(new TextClip({
        start: 0,
        duration: 4,
        track: 2,
        text: 'CENTER ALIGN\nWIDE TRACKING',
        placement: { x: '50%', y: '40%', anchor: 'center' },
        style: {
          fontFamily: QA_FONT_MONO,
          fontSize: 34,
          fontWeight: 600,
          color: '#f8fffd',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          padding: 18,
          lineHeight: 1.22,
          align: 'center',
          letterSpacing: 6,
        },
      }));

      timeline.add(new TextClip({
        start: 0,
        duration: 4,
        track: 3,
        text: 'right aligned\nannotation',
        placement: { x: '90%', y: '72%', anchor: 'bottom-right' },
        style: {
          fontFamily: QA_FONT_SERIF,
          fontSize: 30,
          fontWeight: 700,
          color: '#ecfffb',
          backgroundColor: 'rgba(15, 25, 29, 0.44)',
          padding: 16,
          lineHeight: 1.08,
          align: 'right',
        },
      }));
    },
  },
  {
    id: 'track-scope',
    title: 'Track Effect Scope',
    description: 'Blur stays on the targeted layer instead of bleeding into lower tracks.',
    duration: 4,
    timestamps: [0, 1.8, 3.8],
    build({ timeline, sdk }) {
      const { EffectClip, ImageClip, TextClip } = sdk;
      addBackground(timeline, ImageClip, 4, createBackdrop('#1b1c24', '#384562', '#ffb15d'));

      timeline.add(new ImageClip({
        start: 0,
        duration: 4,
        track: 1,
        src: createStripedCard('#ff9a5e', '#cb4e3d', '#fff4dc'),
        placement: {
          x: '50%',
          y: '50%',
          width: '54%',
          height: '56%',
          anchor: 'center',
        },
      }));

      timeline.add(new EffectClip({
        start: 0,
        duration: 4,
        track: 1,
        effect: 'blur',
        params: { intensity: 5 },
      }));

      timeline.add(new TextClip({
        start: 0,
        duration: 4,
        track: 2,
        text: 'lower tracks stay sharp',
        placement: { x: '8%', y: '86%', anchor: 'bottom-left' },
        style: {
          fontFamily: QA_FONT_MONO,
          fontSize: 26,
          fontWeight: 700,
          color: '#fff2e1',
          backgroundColor: 'rgba(18, 18, 24, 0.42)',
          padding: 14,
        },
      }));
    },
  },
  {
    id: 'media-reuse',
    title: 'Media Reuse',
    description: 'The same video source can render twice at different source offsets without fighting itself.',
    duration: 6,
    timestamps: [0.3, 2.2, 4.4],
    build({ timeline, sdk }) {
      const { ImageClip, TextClip, VideoClip } = sdk;
      addBackground(timeline, ImageClip, 6, ASSETS.wallpaper);

      timeline.add(new VideoClip({
        start: 0,
        duration: 6,
        in: 0.2,
        track: 1,
        src: ASSETS.wideVideo,
        audio: false,
        placement: {
          x: '28%',
          y: '54%',
          width: '44%',
          height: '58%',
          anchor: 'center',
          rotation: -2.5,
        },
      }));

      timeline.add(new VideoClip({
        start: 0,
        duration: 6,
        in: 1.6,
        track: 2,
        src: ASSETS.wideVideo,
        audio: false,
        placement: {
          x: '72%',
          y: '52%',
          width: '44%',
          height: '58%',
          anchor: 'center',
          rotation: 2.5,
        },
      }));

      timeline.add(new TextClip({
        start: 0,
        duration: 6,
        track: 3,
        text: 'same source\ndifferent clocks',
        placement: { x: '50%', y: '10%', anchor: 'top-center' },
        style: {
          fontFamily: QA_FONT_MONO,
          fontSize: 28,
          fontWeight: 700,
          color: '#fffaf3',
          backgroundColor: 'rgba(19, 14, 10, 0.45)',
          padding: 12,
          lineHeight: 1.2,
          align: 'center',
        },
      }));
    },
  },
  {
    id: 'overlay-stack',
    title: 'Overlay Stack',
    description: 'Layered image, video, text, and composition effects for real-world preview coverage.',
    duration: 6,
    timestamps: [0.2, 2.8, 5.6],
    build({ timeline, sdk }) {
      const { EffectClip, ImageClip, TextClip, VideoClip } = sdk;
      addBackground(timeline, ImageClip, 6, ASSETS.wallpaper);

      timeline.add(new VideoClip({
        start: 0,
        duration: 6,
        track: 1,
        src: ASSETS.wideVideo,
        audio: false,
        placement: {
          x: '50%',
          y: '54%',
          width: '72%',
          height: '74%',
          anchor: 'center',
        },
      }));

      timeline.add(new VideoClip({
        start: 0.5,
        duration: 5.5,
        track: 2,
        src: ASSETS.talkingVideo,
        audio: false,
        placement: {
          x: '85%',
          y: '78%',
          width: '22%',
          height: '38%',
          anchor: 'center',
        },
      }));

      timeline.add(new TextClip({
        start: 0,
        duration: 3.2,
        track: 3,
        text: 'Overlay Stack',
        placement: { x: '7%', y: '10%', anchor: 'top-left' },
        style: {
          fontFamily: QA_FONT_SERIF,
          fontSize: 64,
          fontWeight: 700,
          color: '#fff7ed',
          lineHeight: 0.92,
        },
      }));

      timeline.add(new TextClip({
        start: 2.4,
        duration: 3.4,
        track: 3,
        text: 'blur track / fade composition / stacked captions',
        placement: { x: '7%', y: '88%', anchor: 'bottom-left' },
        style: {
          fontFamily: QA_FONT_MONO,
          fontSize: 22,
          color: '#fff5ea',
          backgroundColor: 'rgba(21, 16, 12, 0.48)',
          padding: 14,
          lineHeight: 1.24,
        },
      }));

      timeline.add(new EffectClip({
        start: 0,
        duration: 1.2,
        track: -1,
        effect: 'fade',
        params: { from: 0.2, to: 1 },
      }));
    },
  },
  {
    id: 'audio-export',
    title: 'Audio Export',
    description: 'Audio-enabled export coverage with a linked video companion and caption overlays.',
    duration: 3.24,
    timestamps: [0, 1.6, 3.2],
    build({ timeline, sdk }) {
      const { ImageClip, TextClip, VideoClip } = sdk;
      addBackground(timeline, ImageClip, 3.24, createBackdrop('#151819', '#2e3e43', '#dca86b'));

      timeline.add(new VideoClip({
        start: 0,
        duration: 3.24,
        out: 3.24,
        track: 1,
        src: ASSETS.wideVideo,
        audio: true,
        placement: {
          x: '50%',
          y: '54%',
          width: '68%',
          height: '72%',
          anchor: 'center',
        },
      }));

      timeline.add(new TextClip({
        start: 0,
        duration: 3.24,
        track: 2,
        text: 'audio-on export scene',
        placement: { x: '50%', y: '10%', anchor: 'top-center' },
        style: {
          fontFamily: QA_FONT_MONO,
          fontSize: 24,
          fontWeight: 700,
          color: '#fffdf7',
          backgroundColor: 'rgba(19, 22, 22, 0.42)',
          padding: 10,
          align: 'center',
        },
      }));
    },
  },
  {
    id: 'final-frame',
    title: 'Final Frame',
    description: 'Exact end-time seeking should hold the last visible frame instead of clearing the canvas.',
    duration: 2.5,
    timestamps: [0, 1.25, 2.5],
    build({ timeline, sdk }) {
      const { EffectClip, ImageClip, TextClip } = sdk;
      addBackground(timeline, ImageClip, 2.5, createBackdrop('#131022', '#42335c', '#f3904f'));

      timeline.add(new TextClip({
        start: 0,
        duration: 2.5,
        track: 1,
        text: 'hold on the final frame',
        placement: { x: '50%', y: '50%', anchor: 'center' },
        style: {
          fontFamily: QA_FONT_SERIF,
          fontSize: 56,
          fontWeight: 700,
          color: '#fff3df',
          backgroundColor: 'rgba(23, 14, 29, 0.4)',
          padding: 18,
          align: 'center',
        },
      }));

      timeline.add(new EffectClip({
        start: 0,
        duration: 0.8,
        track: -1,
        effect: 'fade',
        params: { from: 0.25, to: 1 },
      }));
    },
  },
];

export function listScenes() {
  return SCENES.map(({ build, ...scene }) => scene);
}

export function getScene(sceneId = DEFAULT_SCENE_ID) {
  return SCENES.find((scene) => scene.id === sceneId) ?? SCENES[0];
}

export function getResolutionPreset(resolutionId = DEFAULT_RESOLUTION_ID) {
  return RESOLUTION_PRESETS.find((preset) => preset.id === resolutionId) ?? RESOLUTION_PRESETS.at(-1);
}

export function buildScene({ sdk, sceneId = DEFAULT_SCENE_ID, resolutionId = DEFAULT_RESOLUTION_ID }) {
  const scene = getScene(sceneId);
  const resolution = getResolutionPreset(resolutionId);
  const timeline = new sdk.Timeline({
    width: resolution.width,
    height: resolution.height,
    fps: 30,
  });

  scene.build({ timeline, sdk, resolution, assets: ASSETS });

  return { scene, resolution, timeline };
}
