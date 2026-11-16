import { defineConfig } from '@playwright/test';
const port = process.env.LOCALTRACE_TEST_PORT || '4173';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './web-e2e', timeout: 60000, workers: 1, reporter: 'list',
  use: { baseURL, ...process.env.LOCALTRACE_BROWSER_CHANNEL ? { channel: process.env.LOCALTRACE_BROWSER_CHANNEL } : {} },
  webServer: { command: 'node server/server.cjs', url: baseURL, env: { PORT: port, HOST: '127.0.0.1', PUBLIC_ORIGIN: '' }, reuseExistingServer: false },
});
