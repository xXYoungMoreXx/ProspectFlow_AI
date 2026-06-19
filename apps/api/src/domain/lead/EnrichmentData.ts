/**
 * EnrichmentData — Value Object that holds all external-source data
 * gathered by the Hunter agent about a prospect.
 *
 * WHY a separate VO: enrichment fields grow independently of the Lead
 * aggregate's lifecycle fields (status, score, contact).  Keeping them
 * isolated makes the Lead aggregate leaner and lets the Hunter pipeline
 * replace/update enrichment without touching Lead business rules.
 *
 * SPEC-03 v2.1 adds Google Places extended fields.
 */
import type { ServiceType } from "@hefesto/shared-types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EnrichmentDataProps {
  // ── Website / digital presence ─────────────────────────────────────────────
  hasWebsite?: boolean;
  websiteQualityHint?: "outdated" | "mobile_broken" | "ok";

  // ── CNPJ / legal entity ────────────────────────────────────────────────────
  cnpjStatus?: string; // e.g. 'ATIVA', 'BAIXADA', 'SUSPENSA'
  yearsInBusiness?: number;

  // ── Google Places extended fields (SPEC-03 v2.1) ───────────────────────────
  googleMapsUri?: string;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  priceLevel?:
    | "FREE"
    | "INEXPENSIVE"
    | "MODERATE"
    | "EXPENSIVE"
    | "VERY_EXPENSIVE";
  editorialSummary?: string;
  categories?: string[]; // Google Places `types` array
  openingHoursText?: string[]; // weekday descriptions from currentOpeningHours
  internationalPhone?: string;
  photoUris?: string[]; // resolved photo media URIs (max 10)

  // ── Pipeline context ───────────────────────────────────────────────────────
  serviceType?: ServiceType; // which service the Hunter was searching for
}

// ─── Value Object ─────────────────────────────────────────────────────────────

export class EnrichmentData {
  private constructor(private readonly props: EnrichmentDataProps) {}

  static create(props: EnrichmentDataProps = {}): EnrichmentData {
    return new EnrichmentData({ ...props });
  }

  static empty(): EnrichmentData {
    return new EnrichmentData({});
  }

  // ── Website / digital presence ─────────────────────────────────────────────

  get hasWebsite(): boolean | undefined {
    return this.props.hasWebsite;
  }

  get websiteQualityHint(): "outdated" | "mobile_broken" | "ok" | undefined {
    return this.props.websiteQualityHint;
  }

  // ── CNPJ / legal entity ────────────────────────────────────────────────────

  get cnpjStatus(): string | undefined {
    return this.props.cnpjStatus;
  }

  get yearsInBusiness(): number | undefined {
    return this.props.yearsInBusiness;
  }

  // ── Google Places extended fields ──────────────────────────────────────────

  get googleMapsUri(): string | undefined {
    return this.props.googleMapsUri;
  }

  get businessStatus():
    | "OPERATIONAL"
    | "CLOSED_TEMPORARILY"
    | "CLOSED_PERMANENTLY"
    | undefined {
    return this.props.businessStatus;
  }

  get priceLevel():
    | "FREE"
    | "INEXPENSIVE"
    | "MODERATE"
    | "EXPENSIVE"
    | "VERY_EXPENSIVE"
    | undefined {
    return this.props.priceLevel;
  }

  get editorialSummary(): string | undefined {
    return this.props.editorialSummary;
  }

  get categories(): string[] | undefined {
    return this.props.categories;
  }

  get openingHoursText(): string[] | undefined {
    return this.props.openingHoursText;
  }

  get internationalPhone(): string | undefined {
    return this.props.internationalPhone;
  }

  get photoUris(): string[] | undefined {
    return this.props.photoUris;
  }

  // ── Pipeline context ───────────────────────────────────────────────────────

  get serviceType(): ServiceType | undefined {
    return this.props.serviceType;
  }

  // ── Serialisation ──────────────────────────────────────────────────────────

  /** Returns a plain object suitable for storing in the `company_data` JSONB column. */
  toJSON(): EnrichmentDataProps {
    return { ...this.props };
  }

  /**
   * Convenience: produce an EnrichmentScore-compatible view for calculateScore().
   * WHY: LeadQualificationService.calculateScore() uses a minimal interface;
   * mapping here prevents a dependency from the domain service on this VO's internals.
   */
  toScoringInput(): {
    hasWebsite?: boolean;
    websiteQualityHint?: string;
    cnpjStatus?: string;
    yearsInBusiness?: number;
  } {
    return {
      hasWebsite: this.props.hasWebsite,
      websiteQualityHint: this.props.websiteQualityHint,
      cnpjStatus: this.props.cnpjStatus,
      yearsInBusiness: this.props.yearsInBusiness,
    };
  }
}
