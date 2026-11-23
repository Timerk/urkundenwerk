import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/.next/",
    "**/out/",
    "**/dist/",
    "**/coverage/",
    "**/next-env.d.ts",
    "**/playwright-report/",
    "**/test-results/",
  ]),
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts}"],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ["apps/web/**/*.{js,mjs,ts,tsx,mts}"],
    extends: [next.configs["core-web-vitals"]],
    settings: { next: { rootDir: "apps/web/" } },
  },
);
