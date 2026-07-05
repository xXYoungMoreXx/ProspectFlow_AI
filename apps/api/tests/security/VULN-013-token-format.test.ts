import { describe, it, expect } from "vitest";
import { VerifyEmailSchema, ResetPasswordSchema } from "../../src/http/schemas/auth.schemas.js";

describe("VULN-013: Token Format Validation", () => {
  it("should reject non-hex tokens in VerifyEmailSchema", () => {
    const result = VerifyEmailSchema.safeParse({
      token: "G".repeat(64), // 64 chars but not hex
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-hex tokens in ResetPasswordSchema", () => {
    const result = ResetPasswordSchema.safeParse({
      token: "G".repeat(64),
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    expect(result.success).toBe(false);
  });
});
