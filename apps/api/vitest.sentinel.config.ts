import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/security/*.test.ts"],
    hookTimeout: 10000,
    testTimeout: 15000,
    env: {
      DATABASE_URL: "postgres://localhost:5432/test",
      JWT_PRIVATE_KEY: "dummy",
      JWT_PUBLIC_KEY: "dummy",
    }
  },
});
