import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_SECRET: "playwright-test-secret-playwright-test-secret",
      AUTH_URL: "http://127.0.0.1:3000",
      CREW_DATA_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      LOCAL_DATABASE_PATH: ".data/playwright.sqlite",
      NODE_ENV: "test",
      // Tests create isolated demo sandboxes from one IP. Use the existing
      // preview quota so the full suite does not exhaust the production quota.
      VERCEL_ENV: "preview",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
