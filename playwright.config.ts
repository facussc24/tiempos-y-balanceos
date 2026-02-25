import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: 0,
    use: {
        baseURL: 'http://localhost:3000',
        screenshot: 'only-on-failure',
        trace: 'off',
        headless: true,
        viewport: { width: 1440, height: 900 },
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
