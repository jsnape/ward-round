import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
    testDir: "./web/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    use: {
        baseURL: `http://localhost:${PORT}`,
    },
    webServer: {
        command:
            "npm run --workspace @ward-round/web build && npm run --workspace @ward-round/web preview -- --port " +
            PORT,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
