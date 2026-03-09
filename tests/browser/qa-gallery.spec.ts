import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function prepareScene(page: Page, sceneId: string, time: number, resolutionId = '720p') {
  await page.goto('/');
  await page.evaluate(async ({ sceneId: nextSceneId, time: nextTime, resolutionId: nextResolutionId }) => {
    const qa = (window as typeof window & { __videocanvasQA__: any }).__videocanvasQA__;
    await qa.whenReady();
    await qa.setResolution(nextResolutionId);
    await qa.setScene(nextSceneId);
    await qa.seek(nextTime);
  }, {
    sceneId,
    time,
    resolutionId,
  });
}

test('renders the anchor-grid scene at 720p', async ({ page }) => {
  await prepareScene(page, 'anchor-grid', 1.2);
  await expect(page.locator('#previewRoot canvas')).toHaveScreenshot('anchor-grid-720p.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});

test('renders the text-lab scene at 720p', async ({ page }) => {
  await prepareScene(page, 'text-lab', 1.6);
  await expect(page.locator('#previewRoot canvas')).toHaveScreenshot('text-lab-720p.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});

test('renders the track-scope scene without effect bleed', async ({ page }) => {
  await prepareScene(page, 'track-scope', 1.8);
  await expect(page.locator('#previewRoot canvas')).toHaveScreenshot('track-scope-720p.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});

test('renders duplicate-source media reuse independently', async ({ page }) => {
  await prepareScene(page, 'media-reuse', 2.2);
  await expect(page.locator('#previewRoot canvas')).toHaveScreenshot('media-reuse-720p.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('holds the final-frame scene at the exact composition end', async ({ page }) => {
  await prepareScene(page, 'final-frame', 2.5);
  await expect(page.locator('#previewRoot canvas')).toHaveScreenshot('final-frame-720p.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
});
