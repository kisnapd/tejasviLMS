import {defineConfig,devices} from '@playwright/test';

// End-to-end QA suite. Runs against an isolated server (tests/qa/server.mjs) on port 3200
// backed by the `tejasvi_qa` database, wiped at the start of every run.
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'storage/qa/results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {timeout: 10_000},
  reporter: [['list'], ['html', {outputFolder: 'storage/qa/report', open: 'never'}]],
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {name: 'setup', testMatch: /global\.setup\.ts/},
    {name: 'desktop', dependencies: ['setup'], testIgnore: /mobile\.spec\.ts/, use: {...devices['Desktop Chrome'], viewport: {width: 1366, height: 860}}},
    {name: 'mobile', dependencies: ['setup'], testMatch: /mobile\.spec\.ts/, use: {...devices['Pixel 7']}},
  ],
  webServer: {
    command: 'node tests/qa/server.mjs --reset',
    url: 'http://localhost:3200/login',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
