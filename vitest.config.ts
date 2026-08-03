import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/**/*.ts"],
      exclude: [
        "packages/**/*.test.ts",
        "packages/**/*.d.ts",
      ],
    },
  },
});
