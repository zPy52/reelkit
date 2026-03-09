import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:8765',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1260 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
  webServer: {
    command: 'npm run preview:gallery',
    port: 8765,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
