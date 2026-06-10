import { describe, it, expect } from "vitest";
import { calculateScore } from "./LeadQualificationService.js";

describe("calculateScore() with ServiceType", () => {
  // SITE_CREATION: noWebsite=35, cnpjAtiva=20, yearsInBusiness=10, goodRating=15, someReviews=7 → 87
  it("SITE_CREATION: no-website lead with rating 4.0 and 50 reviews scores 87", () => {
    const place = { rating: 4.0, reviewsCount: 50 };
    const enrichment = {
      hasWebsite: false,
      cnpjStatus: "ATIVA",
      yearsInBusiness: 3,
    };
    expect(calculateScore(place, enrichment, "SITE_CREATION")).toBe(87);
  });

  // TRAFFIC_MANAGEMENT: hasWebsite=0, cnpjAtiva=20, yearsInBusiness=10, goodRating=20, manyReviews=25 → 75
  it("TRAFFIC_MANAGEMENT: with website, active CNPJ, 4.0 rating, 200 reviews scores 75", () => {
    const place = { rating: 4.0, reviewsCount: 200 };
    const enrichment = {
      hasWebsite: true,
      cnpjStatus: "ATIVA",
      yearsInBusiness: 3,
    };
    expect(calculateScore(place, enrichment, "TRAFFIC_MANAGEMENT")).toBe(75);
  });

  // SOCIAL_MEDIA: hasWebsite=0, cnpjAtiva=20, yearsInBusiness=10, highRating=30, fewReviews=6 → 66
  it("SOCIAL_MEDIA: with website, active CNPJ, 4.8 rating, 10 reviews scores 66", () => {
    const place = { rating: 4.8, reviewsCount: 10 };
    const enrichment = {
      hasWebsite: true,
      cnpjStatus: "ATIVA",
      yearsInBusiness: 3,
    };
    expect(calculateScore(place, enrichment, "SOCIAL_MEDIA")).toBe(66);
  });

  // FULL_DIGITAL: noWebsite=30, cnpjAtiva=20, yearsInBusiness=10, highRating=25, manyReviews=15 → 100
  it("FULL_DIGITAL: no-website, active CNPJ, 4.5 rating, 100 reviews scores 100", () => {
    const place = { rating: 4.5, reviewsCount: 100 };
    const enrichment = {
      hasWebsite: false,
      cnpjStatus: "ATIVA",
      yearsInBusiness: 3,
    };
    expect(calculateScore(place, enrichment, "FULL_DIGITAL")).toBe(100);
  });

  it("never exceeds 100", () => {
    const place = { rating: 5.0, reviewsCount: 1000 };
    const enrichment = {
      hasWebsite: false,
      cnpjStatus: "ATIVA",
      yearsInBusiness: 10,
    };
    for (const st of [
      "SITE_CREATION",
      "TRAFFIC_MANAGEMENT",
      "SOCIAL_MEDIA",
      "FULL_DIGITAL",
    ] as const) {
      expect(calculateScore(place, enrichment, st)).toBeLessThanOrEqual(100);
    }
  });

  it("never goes negative", () => {
    const place = { rating: undefined, reviewsCount: 0 };
    for (const st of [
      "SITE_CREATION",
      "TRAFFIC_MANAGEMENT",
      "SOCIAL_MEDIA",
      "FULL_DIGITAL",
    ] as const) {
      expect(
        calculateScore(place, { hasWebsite: true }, st),
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
