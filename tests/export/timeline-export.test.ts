// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextClip, Timeline } from '@/index';

const pipelineRun = vi.fn();
let pipelineOptions: Record<string, unknown> | null = null;

vi.mock('@/export/export-pipeline', () => {
  return {
    ExportPipeline: class {
      public constructor(_timeline: unknown, options: Record<string, unknown>) {
        pipelineOptions = options;
      }

      public run() {
        return pipelineRun();
      }
    },
  };
});

describe('timeline export', () => {
  beforeEach(() => {
    pipelineRun.mockReset();
    pipelineOptions = null;

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:export'),
    });
  });

  it('exports a blob and emits export lifecycle events', async () => {
    pipelineRun.mockImplementation(async () => {
      (pipelineOptions?.onProgress as ((progress: number) => void) | undefined)?.(0.5);

      return {
        blob: new Blob(['video'], { type: 'video/mp4' }),
        duration: 2,
        stats: {
          totalFrames: 60,
          encodingTimeMs: 120,
          fileSizeBytes: 5,
        },
      };
    });

    const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });
    timeline.add(new TextClip({
      start: 0,
      duration: 2,
      text: 'export',
    }));

    const events: string[] = [];
    const progress: number[] = [];
    timeline.on('export-start', () => events.push('start'));
    timeline.on('export-progress', (value) => {
      events.push('progress');
      progress.push(value);
    });
    timeline.on('export-complete', () => events.push('complete'));

    const result = await timeline.exportBlob({ format: 'mp4' });

    expect(result.url).toBe('blob:export');
    expect(events[0]).toBe('start');
    expect(events).toContain('complete');
    expect(progress).toEqual([0, 0.5]);
  });

  it('emits export-error when the pipeline fails', async () => {
    pipelineRun.mockRejectedValue(new Error('pipeline failed'));

    const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });
    timeline.add(new TextClip({
      start: 0,
      duration: 2,
      text: 'export',
    }));

    const errors: string[] = [];
    timeline.on('export-error', (error) => {
      errors.push(error.message);
    });

    await expect(timeline.exportBlob()).rejects.toThrow('pipeline failed');
    expect(errors).toEqual(['pipeline failed']);
  });
});
