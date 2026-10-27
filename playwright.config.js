// Smoke test: builds the site, serves the build and walks the main path a visitor takes.
// Run with: npm test
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4178/',
    // software WebGL, so the 3D exhibition and the dive transition run in CI too
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4178 --strictPort',
    url: 'http://localhost:4178/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
