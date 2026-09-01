import { defineConfig, devices } from "@playwright/test";

const useDevelopmentServer = process.env.E2E_USE_DEV === "true";
const previewPort = useDevelopmentServer ? 5173 : 4173;
const previewOrigin = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: true,
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
        },
        {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
        },
    ],
    reporter: process.env.CI ? "github" : "list",
    retries: process.env.CI ? 2 : 0,
    testDir: "./e2e",
    timeout: 60_000,
    use: {
        baseURL: previewOrigin,
        locale: "en-US",
        trace: "on-first-retry",
    },
    webServer: useDevelopmentServer
        ? undefined
        : {
              command: `npm run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
              url: previewOrigin,
          },
    workers: process.env.CI ? 1 : undefined,
});
