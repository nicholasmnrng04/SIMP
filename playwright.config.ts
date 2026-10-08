import { defineConfig, devices } from '@playwright/test';

const serverEnvironment = {
  HOST: '127.0.0.1', PORT: '3141', LOG_LEVEL: 'silent',
  APP_ORIGINS: 'http://127.0.0.1:5174', COOKIE_SECURE: 'false',
  DATABASE_SCHEMA: process.env.DATABASE_SCHEMA || 'invalid_missing_test_schema', UPLOAD_DIR: process.env.SIMP_TEST_UPLOAD_DIR || './.tmp/browser-uploads',
};
const useBuiltServer = process.env.SIMP_TEST_BUILT === 'true';
const useExternalServers = process.env.SIMP_TEST_EXTERNAL_SERVERS === 'true';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: useExternalServers ? undefined : [
    { command: useBuiltServer ? 'node dist/server/index.js' : 'node --import tsx server/index.ts', url: 'http://127.0.0.1:3141/api/health', env: serverEnvironment, reuseExistingServer: false, timeout: 30000 },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174', env: serverEnvironment, reuseExistingServer: false, timeout: 30000 },
  ],
});
