/**
 * API response envelope contracts — PRD §12
 * All API responses use these typed envelopes
 */

// ─── Success Response ────────────────────────────────────────────────────────

export interface ApiMeta {
  readonly requestId: string; // ULID for tracing
  readonly timestamp: string; // ISO 8601
}

export interface ApiResponse<T> {
  readonly data: T;
  readonly meta: ApiMeta;
}

// ─── Paginated Response ──────────────────────────────────────────────────────

export interface CursorPagination {
  readonly next: string | null;
  readonly prev: string | null;
}

export interface PaginatedMeta extends ApiMeta {
  readonly cursor: CursorPagination;
  readonly total: number;
  readonly limit: number;
}

export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly meta: PaginatedMeta;
}

// ─── Error Response ──────────────────────────────────────────────────────────

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly requestId: string;
}

export interface ErrorResponse {
  readonly errors: ApiError[];
}

// ─── Common error codes ──────────────────────────────────────────────────────

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INSUFFICIENT_BUDGET: "INSUFFICIENT_BUDGET",
  HITL_EXPIRED: "HITL_EXPIRED",
  SECURITY_VIOLATION: "SECURITY_VIOLATION",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
