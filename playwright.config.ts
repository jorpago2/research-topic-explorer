import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173/research-topic-explorer/",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm exec vite preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/research-topic-explorer/",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_BASE_PATH: "/research-topic-explorer/",
      VITE_API_BASE_URL: "http://127.0.0.1:8787",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
