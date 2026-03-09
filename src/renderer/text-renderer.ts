import type { TextClip } from '../clips';

type TextCanvas = HTMLCanvasElement | OffscreenCanvas;

function createCanvas(width: number, height: number): TextCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export class TextRenderer {
  private static readonly cache = new Map<string, TextCanvas>();

  public static render(clip: TextClip): TextCanvas {
    const key = JSON.stringify({ text: clip.text, style: clip.style });
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const fontSize = clip.style.fontSize ?? 48;
    const padding = clip.style.padding ?? 0;
    const lineHeight = clip.style.lineHeight ?? 1.2;
    const lines = clip.text.split('\n');
    const measurementCanvas = createCanvas(16, 16);
    const measurementContext = measurementCanvas.getContext('2d');

    if (!measurementContext) {
      throw new Error('Unable to acquire a 2D canvas context for text rendering.');
    }

    measurementContext.font = `${clip.style.fontWeight ?? 600} ${fontSize}px ${
      clip.style.fontFamily ?? 'Georgia, serif'
    }`;

    const lineWidths = lines.map((line) => measurementContext.measureText(line).width);
    const width = Math.ceil(Math.max(...lineWidths, 1) + padding * 2);
    const height = Math.ceil(lines.length * fontSize * lineHeight + padding * 2);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to acquire a 2D canvas context for text rendering.');
    }

    context.font = measurementContext.font;
    context.textAlign = clip.style.align ?? 'left';
    context.textBaseline = 'top';
    context.fillStyle = clip.style.backgroundColor ?? 'transparent';
    if (clip.style.backgroundColor) {
      context.fillRect(0, 0, width, height);
    }

    context.fillStyle = clip.style.color ?? '#ffffff';

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      context.fillText(line, padding, padding + index * fontSize * lineHeight);
    }

    this.cache.set(key, canvas);
    return canvas;
  }

  public static invalidate(clip: TextClip): void {
    const key = JSON.stringify({ text: clip.text, style: clip.style });
    this.cache.delete(key);
  }
}
