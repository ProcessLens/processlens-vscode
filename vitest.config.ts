import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/", "out/", "media/", "*.config.ts"],
    },
  },
  resolve: {
    alias: {
      // Mock the vscode module for testing
      vscode: new URL("./tests/mocks/vscode.ts", import.meta.url).pathname,
    },
  },
});
