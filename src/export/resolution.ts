import { QUALITY_BITRATES_1080P } from './types';
import type {
  ExportQuality,
  ExportResolution,
  ResolvedExportResolution,
} from './types';

export class SubmoduleExportServiceResolution {
  public resolve(
    resolution: ExportResolution | undefined,
    timelineWidth: number,
    timelineHeight: number,
  ): ResolvedExportResolution {
    this.assertPositive('timelineWidth', timelineWidth);
    this.assertPositive('timelineHeight', timelineHeight);

    if (!resolution) {
      return this.roundEven(timelineWidth, timelineHeight);
    }

    const aspectRatio = timelineWidth / timelineHeight;
    const width = resolution.width;
    const height = resolution.height;

    if (typeof width === 'number' && typeof height === 'number') {
      return this.roundEven(width, height);
    }

    if (typeof width === 'number') {
      return this.roundEven(width, Math.round(width / aspectRatio));
    }

    if (typeof height === 'number') {
      return this.roundEven(Math.round(height * aspectRatio), height);
    }

    return this.roundEven(timelineWidth, timelineHeight);
  }

  public bitrate(
    quality: ExportQuality,
    width: number,
    height: number,
  ): number {
    this.assertPositive('width', width);
    this.assertPositive('height', height);

    const referencePixels = 1920 * 1080;
    const scale = (width * height) / referencePixels;
    return Math.max(1, Math.round(QUALITY_BITRATES_1080P[quality] * scale));
  }

  private roundEven(width: number, height: number): ResolvedExportResolution {
    this.assertPositive('width', width);
    this.assertPositive('height', height);

    return {
      width: this.toEven(width),
      height: this.toEven(height),
    };
  }

  private toEven(value: number): number {
    const rounded = Math.max(2, Math.round(value));
    return rounded % 2 === 0 ? rounded : rounded + 1;
  }

  private assertPositive(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a positive number.`);
    }
  }
}
