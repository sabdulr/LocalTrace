import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './web-e2e', timeout: 60000, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', ...process.env.LOCALTRACE_BROWSER_CHANNEL ? { channel: process.env.LOCALTRACE_BROWSER_CHANNEL } : {} },
  webServer: { command: 'node server/server.cjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
