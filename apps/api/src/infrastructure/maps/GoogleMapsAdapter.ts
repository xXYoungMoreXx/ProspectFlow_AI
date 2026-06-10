/**
 * GoogleMapsAdapter — wraps Google Places API (New) v1.
 *
 * WHY a dedicated adapter: isolates all Maps-specific HTTP wiring so that
 * changes to the Google Places schema only touch this file, not business logic.
 * Implements the GoogleMapsPort domain interface (SPEC-03 v2.1).
 */

// ─── GooglePlace (public shape returned to callers) ──────────────────────────

export interface GooglePlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  // ── New fields added in SPEC-03 v2.1 ──────────────────────────────────────
  shortFormattedAddress?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  priceLevel?:
    | "FREE"
    | "INEXPENSIVE"
    | "MODERATE"
    | "EXPENSIVE"
    | "VERY_EXPENSIVE";
  openingHours?: { weekdayDescriptions: string[]; openNow?: boolean };
  editorialSummary?: string;
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
}

// ─── Raw Google Places API response shapes ────────────────────────────────────

interface RawEditorialSummary {
  text?: string;
}

interface RawOpeningHours {
  weekdayDescriptions?: string[];
  openNow?: boolean;
}

interface RawPhoto {
  name: string;
  widthPx: number;
  heightPx: number;
}

interface RawGooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
  priceLevel?: string;
  currentOpeningHours?: RawOpeningHours;
  editorialSummary?: RawEditorialSummary;
  photos?: RawPhoto[];
}

interface GooglePlacesResponse {
  places?: RawGooglePlace[];
}

// ─── Search params ────────────────────────────────────────────────────────────

export interface LeadSearchParams {
  category: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  maxResults?: number;
  languageCode?: string;
}

// ─── Field mask ───────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
  "places.priceLevel",
  "places.currentOpeningHours",
  "places.editorialSummary",
  "places.photos",
].join(",");

const PLACES_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class GoogleMapsAdapter {
  constructor(private readonly apiKey: string) {}

  /**
   * Search for nearby places matching a category around a lat/lng point.
   */
  async searchLeads(params: LeadSearchParams): Promise<GooglePlace[]> {
    const response = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": REQUIRED_FIELDS,
        "Accept-Language": "pt-BR",
      },
      body: JSON.stringify({
        includedTypes: [params.category.toLowerCase().replace(/\s+/g, "_")],
        locationRestriction: {
          circle: {
            center: { latitude: params.lat, longitude: params.lng },
            radius: params.radiusMeters,
          },
        },
        maxResultCount: params.maxResults ?? 20,
        languageCode: params.languageCode ?? "pt-BR",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `Google Places API error ${response.status}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as GooglePlacesResponse;
    return this.mapToPlaces(data.places ?? []);
  }

  /**
   * Build a signed photo media URI from a photo resource name.
   * WHY: photo `name` fields returned by Places API are opaque resource paths;
   * the caller needs a full URI to display or store images.
   */
  buildPhotoUri(photoName: string, maxWidthPx = 800): string {
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${this.apiKey}`;
  }

  private mapToPlaces(raw: RawGooglePlace[]): GooglePlace[] {
    return raw.map((p) => ({
      id: p.id,
      displayName: p.displayName?.text ?? "",
      formattedAddress: p.formattedAddress ?? "",
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      rating: p.rating ?? null,
      reviewsCount: p.userRatingCount ?? null,
      // ── New fields (SPEC-03 v2.1) ──────────────────────────────────────────
      shortFormattedAddress: p.shortFormattedAddress,
      internationalPhoneNumber: p.internationalPhoneNumber,
      googleMapsUri: p.googleMapsUri,
      primaryType: p.primaryType,
      types: p.types,
      businessStatus: p.businessStatus as GooglePlace["businessStatus"],
      priceLevel: p.priceLevel as GooglePlace["priceLevel"],
      openingHours: p.currentOpeningHours
        ? {
            weekdayDescriptions:
              p.currentOpeningHours.weekdayDescriptions ?? [],
            openNow: p.currentOpeningHours.openNow,
          }
        : undefined,
      editorialSummary: p.editorialSummary?.text,
      photos: (p.photos ?? []).slice(0, 10).map((ph) => ({
        name: ph.name,
        widthPx: ph.widthPx,
        heightPx: ph.heightPx,
      })),
    }));
  }
}
