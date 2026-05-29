import { defineConfig } from "vitest/config";

/**
 * Single root config with one project per package (Vitest v3 `projects`).
 * Coverage is aggregated across all projects and gated hard in CI:
 * the pure packages must hit 100% line+branch; the web app must hit 80%.
 */
export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: "engine",
                    root: "packages/engine",
                    environment: "node",
                    include: ["src/**/*.test.ts"],
                },
            },
            {
                test: {
                    name: "contract",
                    root: "packages/contract",
                    environment: "node",
                    include: ["src/**/*.test.ts"],
                },
            },
            {
                test: {
                    name: "scoring",
                    root: "packages/scoring",
                    environment: "node",
                    include: ["src/**/*.test.ts"],
                },
            },
            {
                test: {
                    name: "host",
                    root: "packages/host",
                    environment: "node",
                    include: ["src/**/*.test.ts"],
                },
            },
            {
                test: {
                    name: "web",
                    root: "web",
                    environment: "node",
                    include: ["src/lib/**/*.test.ts"],
                },
            },
        ],
        coverage: {
            provider: "v8",
            all: true,
            include: ["packages/*/src/**/*.ts", "web/src/lib/**/*.ts"],
            exclude: ["**/*.test.ts"],
            reporter: ["text", "html"],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100,
                "web/src/lib/**": {
                    lines: 80,
                    functions: 80,
                    branches: 80,
                    statements: 80,
                },
            },
        },
    },
});
