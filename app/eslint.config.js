import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
    {
        // .svelte linting is added in §12; svelte-check covers components for now.
        ignores: [
            "**/dist/**",
            "**/build/**",
            "**/.svelte-kit/**",
            "**/coverage/**",
            "**/node_modules/**",
            "**/*.svelte",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,js}"],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    {
        files: ["web/**/*.ts"],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
    },
    {
        // The engine is a neutral DES machine: it must not reach for the UI, a
        // sibling package, or the network. This boundary is enforced, not advisory.
        files: ["packages/engine/**/*.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["svelte", "svelte/*"],
                            message: "engine must not depend on Svelte.",
                        },
                        {
                            group: ["@ward-round/*"],
                            message: "engine must not import sibling packages.",
                        },
                        {
                            group: ["http", "https", "node:http", "node:https"],
                            message: "engine must not perform HTTP.",
                        },
                    ],
                },
            ],
        },
    },
    prettier,
);
