// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextClip } from '@/index';
import { TextRenderer } from '@/renderer/text-renderer';
import { createMockCanvasContext, installCanvasMock } from './helpers';

describe('TextRenderer', () => {
  beforeEach(() => {
    installCanvasMock(createMockCanvasContext());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('honors center alignment and letter spacing when drawing text', () => {
    const context = createMockCanvasContext();
    installCanvasMock(context);

    const clip = new TextClip({
      start: 0,
      duration: 2,
      text: 'AB',
      style: {
        fontSize: 20,
        padding: 10,
        align: 'center',
        letterSpacing: 5,
      },
    });

    TextRenderer.render(clip);

    expect(context.fillText.mock.calls).toEqual([
      ['A', 10, 10],
      ['B', 25, 10],
    ]);
  });

  it('re-renders a clip when its text signature changes', () => {
    const clip = new TextClip({
      start: 0,
      duration: 2,
      text: 'before',
    });

    const firstCanvas = TextRenderer.render(clip);
    clip.text = 'after';

    const secondCanvas = TextRenderer.render(clip);

    expect(secondCanvas).not.toBe(firstCanvas);
  });
});
