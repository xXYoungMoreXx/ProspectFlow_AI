import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/security/deals.unit.sentinel.test.ts",
    ],
  },
});
