import { configDefaults, defineConfig } from "vitest/config";

// Keep vitest scoped to unit tests. The Playwright specs under tests/e2e use
// @playwright/test's runner and must not be collected by vitest.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
});
