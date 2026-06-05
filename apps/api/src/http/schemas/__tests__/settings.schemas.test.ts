import { describe, it, expect } from "vitest";
import {
  upsertSettingSchema,
  updateSettingsBodySchema,
  categoryParamsSchema,
} from "../settings.schemas";

describe("settingCategorySchema (via exported schemas)", () => {
  describe("upsertSettingSchema — category field", () => {
    it("accepts all valid categories", () => {
      const valid = [
        "llm_providers",
        "messaging",
        "integrations",
        "system",
        "media",
      ] as const;

      for (const category of valid) {
        expect(() =>
          upsertSettingSchema.parse({
            key: `${category}.test_key`,
            value: "value",
            category,
          }),
        ).not.toThrow();
      }
    });

    it("rejects unknown category", () => {
      expect(() =>
        upsertSettingSchema.parse({
          key: "video.heygen.api_key",
          value: "sk-xxx",
          category: "video",
        }),
      ).toThrow();
    });

    it("accepts media category with a video provider key", () => {
      const result = upsertSettingSchema.parse({
        key: "media.heygen.api_key",
        value: "hg-sk-test",
        category: "media",
        isSecret: true,
      });
      expect(result.category).toBe("media");
      expect(result.key).toBe("media.heygen.api_key");
      expect(result.isSecret).toBe(true);
    });

    it("accepts media category for remotion serve_url (non-secret)", () => {
      const result = upsertSettingSchema.parse({
        key: "media.remotion.serve_url",
        value: "https://lambda.example.com/serve",
        category: "media",
        isSecret: false,
      });
      expect(result.category).toBe("media");
      expect(result.value).toBe("https://lambda.example.com/serve");
    });

    it("accepts media category for seedance model selection", () => {
      const result = upsertSettingSchema.parse({
        key: "media.seedance.default_model",
        value: "seedance-1.0-pro",
        category: "media",
      });
      expect(result.category).toBe("media");
      expect(result.value).toBe("seedance-1.0-pro");
    });
  });

  describe("categoryParamsSchema", () => {
    it("accepts media as a route param", () => {
      const result = categoryParamsSchema.parse({ category: "media" });
      expect(result.category).toBe("media");
    });

    it("rejects unknown category in params", () => {
      expect(() =>
        categoryParamsSchema.parse({ category: "unknown" }),
      ).toThrow();
    });
  });

  describe("updateSettingsBodySchema — batch with media entries", () => {
    it("accepts a batch containing only media settings", () => {
      const result = updateSettingsBodySchema.parse({
        settings: [
          {
            key: "media.heygen.api_key",
            value: "hg-sk-test",
            category: "media",
            isSecret: true,
          },
          {
            key: "media.higgsfield.api_key",
            value: "hf-sk-test",
            category: "media",
            isSecret: true,
          },
          {
            key: "media.seedance.default_model",
            value: "seedance-1.0-lite",
            category: "media",
          },
          {
            key: "media.remotion.serve_url",
            value: "https://lambda.example.com",
            category: "media",
          },
        ],
      });
      expect(result.settings).toHaveLength(4);
      expect(result.settings.every((s) => s.category === "media")).toBe(true);
    });

    it("accepts a mixed batch with both llm_providers and media", () => {
      const result = updateSettingsBodySchema.parse({
        settings: [
          {
            key: "llm.openai.api_key",
            value: "sk-openai",
            category: "llm_providers",
            isSecret: true,
          },
          {
            key: "media.heygen.api_key",
            value: "hg-sk-test",
            category: "media",
            isSecret: true,
          },
        ],
      });
      expect(result.settings).toHaveLength(2);
      expect(result.settings[0]?.category).toBe("llm_providers");
      expect(result.settings[1]?.category).toBe("media");
    });

    it("rejects batch where any entry has unknown category", () => {
      expect(() =>
        updateSettingsBodySchema.parse({
          settings: [
            { key: "media.heygen.api_key", value: "valid", category: "media" },
            { key: "bad.key", value: "bad", category: "video_gen" },
          ],
        }),
      ).toThrow();
    });
  });
});
