import { describe, expect, it } from 'vitest';
import { ExportService } from '@/export';

describe('ExportService resolution', () => {
  it('preserves aspect ratio when only width is provided', () => {
    expect(
      ExportService.resolution.resolve({ width: 1920 }, 1280, 720),
    ).toEqual({ width: 1920, height: 1080 });
  });

  it('preserves aspect ratio when only height is provided', () => {
    expect(
      ExportService.resolution.resolve({ height: 721 }, 1280, 720),
    ).toEqual({ width: 1282, height: 722 });
  });

  it('rounds explicit dimensions to even values', () => {
    expect(
      ExportService.resolution.resolve({ width: 853, height: 479 }, 1280, 720),
    ).toEqual({ width: 854, height: 480 });
  });

  it('scales bitrate by quality preset and resolution', () => {
    const low = ExportService.resolution.bitrate('low', 1280, 720);
    const balanced = ExportService.resolution.bitrate('balanced', 1280, 720);
    const high = ExportService.resolution.bitrate('high', 1280, 720);

    expect(low).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(high);
    expect(ExportService.resolution.bitrate('balanced', 3840, 2160)).toBeGreaterThan(high);
  });
});

describe('ExportService options', () => {
  it('resolves default mp4 settings from the timeline', () => {
    const resolved = ExportService.options.resolve(undefined, {
      width: 1280,
      height: 720,
      fps: 30,
      getDuration: () => 4,
      getClips: () => [],
    });

    expect(resolved).toMatchObject({
      filename: 'composition.mp4',
      format: 'mp4',
      codec: 'avc',
      quality: 'balanced',
      fps: 30,
      audio: true,
      audioCodec: 'aac',
    });
    expect(resolved.resolution).toEqual({ width: 1280, height: 720 });
  });

  it('rejects unsupported codec and format combinations', () => {
    expect(() => {
      ExportService.options.resolve(
        { format: 'mp4', codec: 'vp9' },
        {
          width: 1280,
          height: 720,
          fps: 30,
          getDuration: () => 4,
          getClips: () => [],
        },
      );
    }).toThrow('Codec "vp9" is not supported for the "mp4" format.');
  });
});
