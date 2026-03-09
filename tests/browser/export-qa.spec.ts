import { expect, test } from '@playwright/test';

function assertMonotonicProgress(progress: number[]) {
  expect(progress.length).toBeGreaterThan(0);
  expect(progress[0]).toBeGreaterThanOrEqual(0);
  expect(progress.at(-1)).toBe(1);

  for (let index = 1; index < progress.length; index += 1) {
    expect(progress[index]).toBeGreaterThanOrEqual(progress[index - 1] ?? 0);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const qa = (window as typeof window & { __videocanvasQA__: any }).__videocanvasQA__;
    await qa.whenReady();
  });
});

test('mp4 export stays visually close to preview output', async ({ page }) => {
  const report = await page.evaluate(async () => {
    const qa = (window as typeof window & { __videocanvasQA__: any }).__videocanvasQA__;
    await qa.setScene('text-lab');
    return qa.runExport({
      format: 'mp4',
      compareFrames: true,
      times: [0, 1.6, 3.6],
    });
  });

  expect(report.ok).toBe(true);
  assertMonotonicProgress(report.progress);
  expect(report.size).toBeGreaterThan(0);

  for (const frame of report.frames) {
    expect(frame.meanAbsDiff).toBeLessThan(6);
    expect(frame.maxChannelDiff).toBeLessThan(70);
  }
});

test('webm export stays visually close to preview output', async ({ page }) => {
  const report = await page.evaluate(async () => {
    const qa = (window as typeof window & { __videocanvasQA__: any }).__videocanvasQA__;
    await qa.setScene('media-reuse');
    return qa.runExport({
      format: 'webm',
      compareFrames: true,
      times: [0.3, 2.2, 4.4],
    });
  });

  expect(report.ok).toBe(true);
  assertMonotonicProgress(report.progress);
  expect(report.size).toBeGreaterThan(0);

  for (const frame of report.frames) {
    expect(frame.meanAbsDiff).toBeLessThan(8);
    expect(frame.maxChannelDiff).toBeLessThan(80);
  }
});

test('audio-enabled export produces a larger artifact than video-only export', async ({ page }) => {
  const comparison = await page.evaluate(async () => {
    const qa = (window as typeof window & { __videocanvasQA__: any }).__videocanvasQA__;
    await qa.setScene('audio-export');
    const withoutAudio = await qa.runExport({
      format: 'mp4',
      audio: false,
    });
    const withAudio = await qa.runExport({
      format: 'mp4',
      audio: true,
    });

    return { withoutAudio, withAudio };
  });

  expect(comparison.withoutAudio.ok).toBe(true);
  expect(comparison.withAudio.ok).toBe(true);
  expect(comparison.withAudio.size).toBeGreaterThan(comparison.withoutAudio.size);
});

test('aborted exports surface AbortError with partial progress', async ({ page }) => {
  const report = await page.evaluate(async () => {
    const qa = (window as typeof window & { __videocanvasQA__: any }).__videocanvasQA__;
    await qa.setScene('overlay-stack');
    return qa.runExport({
      format: 'mp4',
      abortAtProgress: 0.25,
    });
  });

  expect(report.ok).toBe(false);
  expect(report.error.name).toBe('AbortError');
  expect(report.progress.length).toBeGreaterThan(0);
  expect(report.progress.at(-1)).toBeLessThan(1);
});
