import type { Clip, EffectClip, ImageClip, TextClip, VideoClip } from '../clips';
import { resolvePlacement } from './placement';
import type { RenderableClip } from './frame-state';
import { MediaPool } from './media-pool';
import { TextRenderer } from './text-renderer';
import { getEffectNode } from './effect-node';

export interface CanvasSize {
  width: number;
  height: number;
}

export interface SurfaceDescriptor extends CanvasSize {
  pixelRatio: number;
}

export class Compositor {
  private scratchCanvas?: HTMLCanvasElement;
  private scratchContext?: CanvasRenderingContext2D;

  public constructor(private readonly pool: MediaPool) {}

  public draw(
    context: CanvasRenderingContext2D,
    clip: RenderableClip,
    time: number,
    canvas: CanvasSize,
    playing: boolean,
  ): void {
    switch (clip.kind) {
      case 'video':
        this.drawVideo(context, clip, time, canvas, playing);
        return;
      case 'image':
        this.drawImage(context, clip, canvas);
        return;
      case 'text':
        this.drawText(context, clip, canvas);
        return;
    }
  }

  public applyEffects(
    context: CanvasRenderingContext2D,
    effects: readonly EffectClip[],
    time: number,
    sourceCanvas: HTMLCanvasElement,
    surface: SurfaceDescriptor,
  ): void {
    if (effects.length === 0) {
      return;
    }

    const scratchContext = this.configureScratchCanvas(sourceCanvas, surface);
    if (!scratchContext) {
      return;
    }

    for (const effect of effects) {
      const node = getEffectNode(effect.effect);
      const filter = node?.getFilter(time, effect);
      if (!filter) {
        continue;
      }

      scratchContext.clearRect(0, 0, surface.width, surface.height);
      scratchContext.drawImage(
        sourceCanvas,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height,
        0,
        0,
        surface.width,
        surface.height,
      );

      context.save();
      context.clearRect(0, 0, surface.width, surface.height);
      context.filter = filter;
      context.drawImage(
        this.scratchCanvas!,
        0,
        0,
        this.scratchCanvas!.width,
        this.scratchCanvas!.height,
        0,
        0,
        surface.width,
        surface.height,
      );
      context.restore();
    }
  }

  public compositeSurface(
    context: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    surface: CanvasSize,
  ): void {
    context.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      surface.width,
      surface.height,
    );
  }

  private drawVideo(
    context: CanvasRenderingContext2D,
    clip: VideoClip,
    time: number,
    canvas: CanvasSize,
    playing: boolean,
  ): void {
    const element = this.pool.syncVideo(clip, time, playing);
    if (element.readyState < 2) {
      return;
    }

    const placement = resolvePlacement(
      clip.placement,
      canvas.width,
      canvas.height,
      element.videoWidth || canvas.width,
      element.videoHeight || canvas.height,
    );

    this.drawSource(context, element, placement);
  }

  private drawImage(
    context: CanvasRenderingContext2D,
    clip: ImageClip,
    canvas: CanvasSize,
  ): void {
    const element = this.pool.getImageElement(clip.src);
    if (!element.complete) {
      return;
    }

    const placement = resolvePlacement(
      clip.placement,
      canvas.width,
      canvas.height,
      element.naturalWidth || canvas.width,
      element.naturalHeight || canvas.height,
    );
    this.drawSource(context, element, placement);
  }

  private drawText(
    context: CanvasRenderingContext2D,
    clip: TextClip,
    canvas: CanvasSize,
  ): void {
    const textCanvas = TextRenderer.render(clip);
    const placement = resolvePlacement(
      clip.placement,
      canvas.width,
      canvas.height,
      textCanvas.width,
      textCanvas.height,
    );

    this.drawSource(context, textCanvas, placement);
  }

  private drawSource(
    context: CanvasRenderingContext2D,
    source: CanvasImageSource,
    placement: ReturnType<typeof resolvePlacement>,
  ): void {
    context.save();
    context.globalAlpha = placement.opacity;

    if (placement.rotation !== 0) {
      const centerX = placement.x + placement.width / 2;
      const centerY = placement.y + placement.height / 2;
      context.translate(centerX, centerY);
      context.rotate((placement.rotation * Math.PI) / 180);
      context.translate(-centerX, -centerY);
    }

    context.drawImage(source, placement.x, placement.y, placement.width, placement.height);
    context.restore();
  }

  private configureScratchCanvas(
    sourceCanvas: HTMLCanvasElement,
    surface: SurfaceDescriptor,
  ): CanvasRenderingContext2D | null {
    if (!this.scratchCanvas) {
      this.scratchCanvas = document.createElement('canvas');
    }

    if (
      this.scratchCanvas.width !== sourceCanvas.width
      || this.scratchCanvas.height !== sourceCanvas.height
    ) {
      this.scratchCanvas.width = sourceCanvas.width;
      this.scratchCanvas.height = sourceCanvas.height;
      this.scratchContext = undefined;
    }

    if (!this.scratchContext) {
      this.scratchContext = this.scratchCanvas.getContext('2d') ?? undefined;
    }

    if (!this.scratchContext) {
      return null;
    }

    this.scratchContext.setTransform(surface.pixelRatio, 0, 0, surface.pixelRatio, 0, 0);
    this.scratchContext.filter = 'none';
    return this.scratchContext;
  }
}
