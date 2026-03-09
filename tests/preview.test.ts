// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextClip, Timeline } from '@/index';
import { installCanvasMock } from './helpers';

describe('preview mounting', () => {
  beforeEach(() => {
    installCanvasMock();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1 } as ImageBitmap)));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('mounts a canvas preview and resizes it with the timeline', () => {
    const container = document.createElement('div');
    document.body.append(container);

    const timeline = new Timeline({ width: 1280, height: 720, fps: 30 });
    timeline.add(new TextClip({
      start: 0,
      duration: 5,
      text: 'preview',
      placement: { x: '10%', y: '10%', anchor: 'top-left' },
    }));

    const handle = timeline.mountPreview(container);
    const canvas = container.querySelector('canvas');

    expect(handle.canvas).toBe(canvas);
    expect(canvas?.width).toBe(1280);
    expect(canvas?.height).toBe(720);

    timeline.setResolution(640, 360);

    expect(canvas?.width).toBe(640);
    expect(canvas?.height).toBe(360);

    handle.destroy();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders an offscreen frame through createImageBitmap', async () => {
    const timeline = new Timeline({ width: 800, height: 450, fps: 24 });
    timeline.add(new TextClip({
      start: 0,
      duration: 2,
      text: 'frame',
    }));

    await timeline.getFrameAt(0.5);

    expect(createImageBitmap).toHaveBeenCalledTimes(1);
  });

  it('keeps the final visual frame visible at the exact composition end', async () => {
    const context = installCanvasMock();
    const container = document.createElement('div');
    document.body.append(container);

    const timeline = new Timeline({ width: 640, height: 360, fps: 30 });
    timeline.add(new TextClip({
      start: 0,
      duration: 1,
      text: 'final frame',
    }));

    const handle = timeline.mountPreview(container);
    context.drawImage.mockClear();

    handle.seek(timeline.getDuration());
    expect(context.drawImage).toHaveBeenCalled();

    context.drawImage.mockClear();
    await timeline.getFrameAt(timeline.getDuration());
    expect(context.drawImage).toHaveBeenCalled();
  });
});
