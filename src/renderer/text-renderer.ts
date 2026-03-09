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
  private static readonly cache = new WeakMap<TextClip, { signature: string; canvas: TextCanvas }>();

  public static render(clip: TextClip): TextCanvas {
    const signature = JSON.stringify({ text: clip.text, style: clip.style });
    const cached = this.cache.get(clip);
    if (cached?.signature === signature) {
      return cached.canvas;
    }

    const fontSize = clip.style.fontSize ?? 48;
    const padding = clip.style.padding ?? 0;
    const lineHeight = clip.style.lineHeight ?? 1.2;
    const letterSpacing = clip.style.letterSpacing ?? 0;
    const align = clip.style.align ?? 'left';
    const lines = clip.text.split('\n');
    const measurementCanvas = createCanvas(16, 16);
    const measurementContext = measurementCanvas.getContext('2d');

    if (!measurementContext) {
      throw new Error('Unable to acquire a 2D canvas context for text rendering.');
    }

    measurementContext.font = `${clip.style.fontWeight ?? 600} ${fontSize}px ${
      clip.style.fontFamily ?? 'Georgia, serif'
    }`;

    const lineWidths = lines.map((line) => this.measureLineWidth(measurementContext, line, letterSpacing));
    const width = Math.ceil(Math.max(...lineWidths, 1) + padding * 2);
    const height = Math.ceil(lines.length * fontSize * lineHeight + padding * 2);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to acquire a 2D canvas context for text rendering.');
    }

    context.font = measurementContext.font;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = clip.style.backgroundColor ?? 'transparent';
    if (clip.style.backgroundColor) {
      context.fillRect(0, 0, width, height);
    }

    context.fillStyle = clip.style.color ?? '#ffffff';

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineWidth = lineWidths[index] ?? 0;
      const lineX = this.resolveLineX(align, width, padding, lineWidth);
      this.drawLine(
        context,
        line,
        lineX,
        padding + index * fontSize * lineHeight,
        letterSpacing,
      );
    }

    this.cache.set(clip, { signature, canvas });
    return canvas;
  }

  public static invalidate(clip: TextClip): void {
    this.cache.delete(clip);
  }

  private static measureLineWidth(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    line: string,
    letterSpacing: number,
  ): number {
    const characters = Array.from(line);
    if (characters.length === 0) {
      return 0;
    }

    return characters.reduce((width, character, index) => {
      const spacing = index === characters.length - 1 ? 0 : letterSpacing;
      return width + context.measureText(character).width + spacing;
    }, 0);
  }

  private static resolveLineX(
    align: CanvasTextAlign,
    width: number,
    padding: number,
    lineWidth: number,
  ): number {
    switch (align) {
      case 'center':
        return Math.max(padding, (width - lineWidth) / 2);
      case 'right':
      case 'end':
        return width - padding - lineWidth;
      default:
        return padding;
    }
  }

  private static drawLine(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    line: string,
    x: number,
    y: number,
    letterSpacing: number,
  ): void {
    if (letterSpacing === 0 || line.length <= 1) {
      context.fillText(line, x, y);
      return;
    }

    let cursor = x;
    for (const character of Array.from(line)) {
      context.fillText(character, cursor, y);
      cursor += context.measureText(character).width + letterSpacing;
    }
  }
}
