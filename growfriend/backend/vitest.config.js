import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // vitest.setup.js: jest compat shim (global.jest = vi)
    // test/setup.js: MongoDB in-memory server + env vars + afterEach cleanup
    setupFiles: ["./vitest.setup.js", "./test/setup.js"],
    testTimeout: 30000,
    hookTimeout: 90000,
    fileParallelism: false,
  }
});
