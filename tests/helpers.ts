import { vi } from 'vitest';

export interface MockCanvasContext extends Record<string, unknown> {
  clearRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
}

export function createMockCanvasContext(): MockCanvasContext {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    filter: 'none',
    fillStyle: '#000000',
    font: '16px sans-serif',
    globalAlpha: 1,
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    textAlign: 'left',
    textBaseline: 'top',
    translate: vi.fn(),
  };
}

export function installCanvasMock(context = createMockCanvasContext()): MockCanvasContext {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    return context as unknown as CanvasRenderingContext2D;
  });

  return context;
}

export function installAnimationFrameMock() {
  let now = 0;
  let frameId = 0;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameId += 1;
    const id = frameId;
    const timer = setTimeout(() => {
      now += 16;
      callback(now);
    }, 16);
    timers.set(id, timer);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  });
}
