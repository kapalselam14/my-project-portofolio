/**
 * Shared types, enums, and DTO placeholders for MatchUp.
 *
 * Keep this package intentionally small — only types that genuinely need to be
 * shared across the API, admin web, and mobile app belong here.
 */

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

export const Role = {
  Member: 'member',
  Moderator: 'moderator',
  Admin: 'admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ---------------------------------------------------------------------------
// Generic status enum (used for entities until per-domain enums are added)
// ---------------------------------------------------------------------------

export const Status = {
  Active: 'active',
  Inactive: 'inactive',
  Pending: 'pending',
  Archived: 'archived',
} as const;

export type Status = (typeof Status)[keyof typeof Status];

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ---------------------------------------------------------------------------
// Shared domain constants
// ---------------------------------------------------------------------------

export const APP_NAME = 'MatchUp' as const;
export const DEFAULT_PAGE_SIZE = 20 as const;