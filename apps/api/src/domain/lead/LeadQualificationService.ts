import type { ServiceType } from "@hefesto/shared-types";

// WHY: Each service type has different value drivers. SITE_CREATION heavily
// weights "no website" (35 pts) because that IS the sales hook. TRAFFIC_MANAGEMENT
// values review volume more because social proof drives ad-spend decisions.

interface ScoringWeights {
  noWebsite: number;
  outdatedSite: number;
  mobileBroken: number;
  cnpjAtiva: number;
  yearsInBusiness: number;
  highRating: number;
  goodRating: number;
  okRating: number;
  manyReviews: number;
  someReviews: number;
  fewReviews: number;
}

const SCORING_WEIGHTS: Record<ServiceType, ScoringWeights> = {
  SITE_CREATION: {
    noWebsite: 35,
    outdatedSite: 25,
    mobileBroken: 18,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 20,
    goodRating: 15,
    okRating: 8,
    manyReviews: 10,
    someReviews: 7,
    fewReviews: 3,
  },
  TRAFFIC_MANAGEMENT: {
    noWebsite: 15,
    outdatedSite: 10,
    mobileBroken: 8,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 25,
    goodRating: 20,
    okRating: 12,
    manyReviews: 25,
    someReviews: 18,
    fewReviews: 8,
  },
  SOCIAL_MEDIA: {
    noWebsite: 10,
    outdatedSite: 8,
    mobileBroken: 5,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 30,
    goodRating: 25,
    okRating: 15,
    manyReviews: 20,
    someReviews: 14,
    fewReviews: 6,
  },
  FULL_DIGITAL: {
    noWebsite: 30,
    outdatedSite: 20,
    mobileBroken: 15,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 25,
    goodRating: 20,
    okRating: 10,
    manyReviews: 15,
    someReviews: 10,
    fewReviews: 5,
  },
};

interface PlaceScore {
  rating?: number;
  reviewsCount?: number;
}

interface EnrichmentScore {
  hasWebsite?: boolean;
  websiteQualityHint?: string;
  cnpjStatus?: string;
  yearsInBusiness?: number;
}

export function calculateScore(
  place: PlaceScore,
  enrichment: EnrichmentScore,
  serviceType: ServiceType = "FULL_DIGITAL",
): number {
  const w = SCORING_WEIGHTS[serviceType];
  let score = 0;

  if (!enrichment.hasWebsite) {
    score += w.noWebsite;
  } else if (enrichment.websiteQualityHint === "outdated") {
    score += w.outdatedSite;
  } else if (enrichment.websiteQualityHint === "mobile_broken") {
    score += w.mobileBroken;
  }

  if (enrichment.cnpjStatus === "ATIVA") score += w.cnpjAtiva;
  if ((enrichment.yearsInBusiness ?? 0) >= 2) score += w.yearsInBusiness;

  if ((place.rating ?? 0) >= 4.5) score += w.highRating;
  else if ((place.rating ?? 0) >= 4.0) score += w.goodRating;
  else if ((place.rating ?? 0) >= 3.5) score += w.okRating;

  if ((place.reviewsCount ?? 0) >= 100) score += w.manyReviews;
  else if ((place.reviewsCount ?? 0) >= 50) score += w.someReviews;
  else if ((place.reviewsCount ?? 0) >= 10) score += w.fewReviews;

  return Math.min(score, 100);
}
