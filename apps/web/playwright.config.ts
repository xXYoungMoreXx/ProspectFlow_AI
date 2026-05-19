import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120 * 1000,
  expect: {
    timeout: 20 * 1000,
  },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [["list"], ["github"], ["html", { open: "never" }], ["junit", { outputFile: "playwright-report/results.xml" }]]
    : [["html"]],
  use: {
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * Web server configuration.
   * - CI: starts `next start` using the pre-built output from the `build` job.
   *   All API calls are mocked with page.route(), so no backend is needed.
   * - Local: reuses the already-running dev server on :3000.
   */
  webServer: {
    command: isCI ? "npx next start" : "npx next dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:3333/api/v1",
    },
  },
});
