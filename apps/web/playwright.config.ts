import { defineConfig, devices } from '@playwright/test';

// E2E against the real stack: starts the API (in-memory, seeded) and the Vite dev
// server (which proxies /api → :8787), then drives a mobile viewport.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'],
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node --import tsx ../api/src/index.ts',
      port: 8787,
      reuseExistingServer: !process.env.CI,
      env: { PORT: '8787' },
    },
    {
      command: 'vite --port 5173',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
