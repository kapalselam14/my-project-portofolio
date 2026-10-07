# MatchUp API Contract

| Field | Value |
|---|---|
| Status | **Draft v1.1 — pending decisions D1–D5. See Delta 2026-09-22 below for endpoints since implemented.** |
| Covers | Mobile app (`apps/mobile`), API server (`apps/api-server`). For `/api/admin/*`, `admin-api-contract.md` is source of truth. |
| Source of truth | This document for mobile endpoints. On conflict between code and this doc, this doc wins once approved. |
| Last updated | 2026-09-04 (delta 2026-09-22) |

## Changelog

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-04 | Initial gap analysis (mobile only). |
| 0.2 | 2026-09-04 | Admin-web endpoints added. |
| 1.0-draft | 2026-09-04 | Full professional rewrite: conventions, auth, errors, endpoint specs, canonical models, gap register, decisions. |
| 1.1-draft | 2026-09-04 | Every endpoint expanded with explicit request (params/body fields) and response (status/body) specs. |
| 1.2-delta | 2026-09-22 | Implemented: `GET /api/calendar/upcoming`, `POST /api/calendar/sync`, `GET /api/activities/search`, `POST /api/chat/:id/messages/image`, `POST /api/chat/:id/messages/location`, `GET /api/chat/conversations`, `GET /api/notifications/unread`, `POST /api/notifications/read-all`, `GET /api/users/:uid/joined|hosted|past-activities`. Calendar sync state is in-memory; chat `unreadCount` is best-effort 0; analytics `retention`/`health` still `[]` with `note`. |

**Notation:** `*` = required. Types: `string`, `int`, `number`, `bool`,
`datetime` (ISO 8601 UTC), `date` (ISO `YYYY-MM-DD`), `enum(...)`.
`→` = responds with. Backend column: ✅ implemented · ⚠️ exists but
wire-incompatible · ❌ missing (clients degrade to local/mock).

---

## 1. Overview

MatchUp has two clients and one API:

| Client | Code | Transport | Mode today |
|---|---|---|---|
| Mobile (Flutter) | `apps/mobile` | `ApiClient` (Dio), base `{API_BASE_URL}/api` | Dual local/remote per repository, selected by `USE_REMOTE_API`. Remote falls back to local on any error. |
| Admin web (React) | `apps/admin-web` | `apiFetch`, base `{VITE_API_BASE_URL}` + absolute paths | Fully mocked (`VITE_USE_MOCK_API=true` default). No live calls. |
| API server (Express + TS, Firestore) | `apps/api-server` | Routers mounted at `/api/<module>` | Implements a subset (see §7). No admin namespace. |

---

## 2. Global conventions

### 2.1 Base URLs and versioning

- Mobile: `{API_BASE_URL}/api`
- Admin: `{VITE_API_BASE_URL}/api/v1/...` (as coded)
- **D1 (decision required):** unify the prefix. Recommendation: `/api/...`
  everywhere and update admin-web service paths (mechanical change, one
  line per service file). Until D1 is resolved, new backend routes MUST be
  added under **both** `/api/<path>` and `/api/v1/<path>` or clients will
  404. This doc writes paths as `/api/...`; if D1 resolves to `/api/v1`,
  prepend `/v1` to every path in §4–§5.

### 2.2 Field naming

- **D2 (decision required):** one casing for all JSON.
  Recommendation: **snake_case** — mobile already parses snake_case on
  every repository, and the newest shapes (ratings, reports, user update)
  are snake_case. Backend currently emits camelCase.
- This doc specifies all fields in **snake_case**. If D2 resolves to
  camelCase, convert field names mechanically; structure is unchanged.

### 2.3 Response envelope

All new endpoints MUST use:

```json
{ "ok": true, "data": <payload> }
{ "ok": false, "error": { "code": "STRING_CODE", "message": "Human readable", "details": {} } }
```

This matches the backend's existing error shape and admin-web's
`ApiResponse<T>`. Mobile's Dio layer unwraps `data` (bare-list responses
such as `GET /activities` returning a raw JSON array are accepted during
transition but new endpoints MUST use the envelope).

### 2.4 Standard error codes

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query failed validation (`details` lists fields). |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired credential. |
| 403 | `FORBIDDEN` | Authenticated but not allowed (incl. non-admin on admin routes). |
| 404 | `NOT_FOUND` | Unknown id or route. |
| 409 | `CONFLICT` | Duplicate (e.g. email already registered, already joined, activity full). |
| 422 | `UNPROCESSABLE` | Semantically invalid state transition. |
| 500 | `INTERNAL_ERROR` | Never leak internals; log server-side. |

### 2.5 Auth

| Client | Scheme | Backend enforcement |
|---|---|---|
| Mobile | `Authorization: Bearer <Firebase ID token>` (auto-injected + refreshed on 401 by `_AuthInterceptor`) | Existing `requireAuth` (Firebase Admin verify → `req.auth.uid`). Identity ALWAYS from token, never trust body uid. |
| Admin web | **D3 (decision required):** token session `{token, user}`. Recommendation: Firebase custom claims (`admin: true`) reusing `requireAuth` + `requireAdmin`, so one auth stack serves both clients. | New `requireAdmin` middleware; `403 FORBIDDEN` for non-admins. |

Admin-web `services/api.ts` still needs header injection + refresh
(TODO in code). Demo credentials (`admin@matchup.app` / `Admin@2026`)
MUST be deleted before any non-local deploy.

### 2.6 Common rules

- Timestamps: ISO 8601 strings, UTC (`2026-10-24T14:23:00Z`). Display
  formatting (e.g. `"Oct 25, 2026"`, `"7:00 PM"`) is a client concern —
  the API MUST NOT return pre-formatted dates.
- Ids: server-generated opaque strings (Firestore doc ids). Clients treat
  them as opaque.
- Pagination: `?limit` (default 20, max 100) + `?offset` (default 0) on
  every list endpoint, including admin lists (admin-web currently sends
  none — backend MUST still paginate with defaults).
- Methods: `GET` read, `POST` action/create, `PATCH` partial update,
  `DELETE` remove. No `POST`-as-`PATCH` for new endpoints (legacy mobile
  calls such as `POST /notifications/:id/read` are grandfathered but
  SHOULD migrate to `PATCH`, see G18).

---

## 3. Canonical data models

Single definition per entity. Clients map these to view models locally.
Full JSON shapes live here; endpoint sections reference them and only
spell out request bodies and deviations.

### 3.1 Activity

```json
{
  "id": "a1",
  "title": "Wednesday Night Futsal Cup",
  "sport_type": "Futsal",
  "description": "...",
  "location": "Sports Hall B",
  "address": "Gate 3, Sports Complex",
  "geohash": "qqg...",
  "start_time": "2026-10-25T19:00:00Z",
  "end_time": "2026-10-25T21:00:00Z",
  "duration_minutes": 120,
  "skill_level": "Intermediate",
  "capacity": 10,
  "participant_count": 10,
  "host_id": "uid",
  "host_name": "Nolan Vance",
  "cover_image_url": null,
  "fee": 10,
  "vibe_tags": ["Competitive"],
  "status": "available"
}
```

`status`: `available | full | completed | cancelled | flagged`.

### 3.2 User

```json
{
  "id": "auth-uid",
  "display_name": "Alex Mercer",
  "email": "alex@example.com",
  "phone": "+62...",
  "bio": "...",
  "location": "Jakarta, Indonesia",
  "sports": [{"sport": "Basketball", "level": "Intermediate"}],
  "rating": 4.9,
  "total_rating_count": 27,
  "activities_joined": 24,
  "activities_hosted": 8,
  "date_of_birth": "1995-03-15",
  "height_cm": 178,
  "weight_kg": 72,
  "goal": "Stay active 3x/week",
  "role": "player",
  "status": "active"
}
```

`role`: `player | host | moderator`. `status`:
`active | inactive | suspended | pending`. Admin `Member` = `User` +
`username`, `joined_date` (ISO).

### 3.3 Participant

```json
{
  "user_id": "p1",
  "name": "Freya Lindqvist",
  "avatar_asset": "sarah_c.png",
  "skill_level": "Advanced",
  "joined_at": "2026-08-30T10:00:00Z",
  "is_organizer": true
}
```

### 3.4 Chat message

```json
{ "id": "", "sender_id": "", "sender_name": "", "sender_avatar": null,
  "text": "", "sent_at": "", "is_mine": false,
  "image_path": null, "latitude": null, "longitude": null }
```

### 3.5 Notification

```json
{ "id": "", "title": "", "body": null, "created_at": "",
  "type": "chat", "unread": true }
```

`type`: `chat | activity | request | moderation | system`.

### 3.6 Report (canonical — reconciles mobile + admin)

```json
{
  "id": "r1",
  "reporter_id": "uid",
  "reporter_name": "Kevin D.",
  "target_id": "user-or-activity-id",
  "target_type": "user",
  "reason": "Discriminatory title & bio chat",
  "category": "harassment",
  "details": "optional free text",
  "activity_id": null,
  "activity_title": "Sunday Pick-Up Elite",
  "sport": "Basketball",
  "status": "pending",
  "admin_note": null,
  "created_at": "2026-10-24T14:23:00Z",
  "resolved_at": null
}
```

`target_type`: `user | activity`. `category`: `harassment | spam |
policy_breach | fraud | inappropriate_content | other` (free-text reasons
map to the closest category, unknown → `other`, full text kept in
`reason`). `status`: `pending | resolved | dismissed`. Reporter fields
are server-derived from the token, never trusted from the body.

### 3.7 Rating submission (request body)

```json
{ "activity_sport_type": "Volleyball", "comment": "Great game!",
  "participant_ratings": [{ "ratee_uid": "p1", "stars": 5 }] }
```

`comment` nullable; `stars` int 1–5; one submission per rater per
activity (7-day edit window — resubmission replaces, never duplicates).

### 3.8 Calendar event

```json
{ "id": "", "activity_id": "", "title": "", "start": "", "end": "",
  "location": "", "synced": false }
```

### 3.9 Broadcast

```json
{ "id": "", "title": "", "message": "", "audience": "all_users",
  "status": "sent", "sent_at": "", "scheduled_at": null, "recipients": 12483 }
```

`audience`: free-form segment key (`all_users`, …).
`status`: `draft | scheduled | sent`. Delivery mechanism (FCM topics?)
is backend's choice — document it here when decided.

---

## 4. Mobile endpoints

Base: `{API_BASE_URL}/api`. Auth: Firebase Bearer on all routes.

### 4.1 Activities

#### M-A1 — List activities feed
- `GET /activities`
- Backend: ⚠️ route exists; response must conform to §3.1.
- Query params:
  | Param | Type | Required | Notes |
  |---|---|---|---|
  | `limit` | int | No (default 20, max 100) | page size |
  | `offset` | int | No (default 0) | page start |
- Request body: none.
- Response `200`: JSON array of `Activity` (§3.1).
- Errors: `401`.

#### M-A2 — Search activities
- `GET /activities/search`
- Backend: ❌ missing.
- Query params:
  | Param | Type | Required | Notes |
  |---|---|---|---|
  | `sport` | string | No | exact sport name |
  | `skill` | string | No | skill level |
  | `max_km` | number | No | max distance in km |
- Request body: none.
- Response `200`: JSON array of `Activity` (§3.1).
- Errors: `400` on invalid `max_km`; `401`.

#### M-A3 — Get activity by id
- `GET /activities/:id`
- Backend: ⚠️ exists; returns camelCase doc — must conform to §3.1.
- Path params: `id*` (activity id).
- Request body: none.
- Response `200`: `Activity` (§3.1).
- Errors: `401`; `404 NOT_FOUND` (unknown id).

#### M-A4 — Create activity
- `POST /activities`
- Backend: ⚠️ exists but reads a different body — must accept the body below.
- Request body (`application/json`):
  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `title` | string | Yes | |
  | `sport_type` | string | Yes | |
  | `location` | string | Yes | venue name |
  | `date_time` | datetime | Yes | start |
  | `max_participants` | int | Yes | capacity |
  | `skill_level` | string | Yes | |
  | `fee` | number | Yes | 0 = free |
  | `duration_minutes` | int | No (default 120) | |
  | `description` | string | No | |
  | `address` | string | No | street address |
  | `geohash` | string | No | for geo queries |
  | `cover_image_url` | string | No | |
- Host identity comes from the auth token (`req.auth.uid`), NOT the body.
- Response `201`: the created `Activity` (§3.1, with server `id`).
- Errors: `400` (missing/invalid fields, `details` lists them); `401`.

#### M-A5 — Join activity
- `POST /activities/:id/join`
- Backend: ❌ missing.
- Path params: `id*`. Request body: none.
- Response `200`: `{ "joined": true }`.
- Errors: `401`; `404` (unknown id); `409 CONFLICT` (already joined or activity full); `422` (cancelled/completed activity).

#### M-A6 — Leave activity
- `POST /activities/:id/leave`
- Backend: ❌ missing.
- Path params: `id*`. Request body: none.
- Response `200`: `{ "left": true }`.
- Errors: `401`; `404`; `409` (not a participant).

#### M-A7 — Cancel activity (host only)
- `POST /activities/:id/cancel`
- Backend: ❌ missing.
- Path params: `id*`. Request body: none.
- Response `200`: `{ "cancelled": true }` (sets `status=cancelled`).
- Errors: `401`; `403` (not the host); `404`.

#### M-A8 — List participants
- `GET /activities/:id/participants`
- Backend: ❌ missing.
- Path params: `id*`. Request body: none.
- Response `200`: JSON array of `Participant` (§3.3).
- Errors: `401`; `404`.

### 4.2 Users

#### M-U1 — Bootstrap user profile (after Firebase sign-up)
- `POST /users`
- Backend: ✅ implemented.
- Request body:
  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `auth_uid` | string | Yes | Firebase uid (must match token) |
  | `email` | string | Yes | normalised server-side |
- Response `201`: empty success (mobile ignores the body).
- Errors: `400` (`authUid/email is required`); `409` (already exists — treat as success client-side).

#### M-U2 — Get user by id
- `GET /users/:uid`
- Backend: ⚠️ route exists (`/:authUid`); shape unverified.
- Path params: `uid*`. Request body: none.
- Response `200`: `User` (§3.2).
- Errors: `401`; `404`.

#### M-U3 — Update own profile
- `PATCH /users/me` (uid from token)
- Backend: ❌ missing.
- Request body (all optional; only present keys are updated):
  | Field | Type | Notes |
  |---|---|---|
  | `display_name` | string | |
  | `bio` | string | |
  | `location` | string | |
  | `email` | string | re-validate format |
  | `phone` | string | |
  | `date_of_birth` | date | `YYYY-MM-DD` |
  | `height_cm` | int | |
  | `weight_kg` | int | |
  | `goal` | string | |
  | `sports` | array of `{sport*, level*}` | replaces the whole list |
- Response `200`: the updated `User` (§3.2).
- Errors: `400`; `401`; `409` (email taken).

#### M-U4 — Activities joined by user
- `GET /users/:uid/joined-activities`
- Backend: ❌ missing. Request body: none.
- Response `200`: JSON array of `Activity` (§3.1). Errors: `401`; `404` (unknown user).

#### M-U5 — Activities hosted by user
- `GET /users/:uid/hosted-activities`
- Backend: ❌ missing. Request body: none.
- Response `200`: JSON array of `Activity` (§3.1). Errors: `401`; `404`.

#### M-U6 — Past activities of user
- `GET /users/:uid/past-activities`
- Backend: ❌ missing. Request body: none.
- Response `200`: JSON array of `Activity` (§3.1, `status=completed`). Errors: `401`; `404`.

### 4.3 Ratings (module missing)

#### M-R1 — Submit activity rating
- `POST /activities/:id/ratings`
- Backend: ❌ missing.
- Path params: `id*` (duplicate of activity; body carries no activity id).
- Request body: §3.7 —
  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `activity_sport_type` | string | Yes | denormalised for moderation context |
  | `comment` | string | No | free text |
  | `participant_ratings` | array of `{ratee_uid*, stars* 1–5}` | Yes (may be empty) | |
- Rater uid from token. Resubmission within the 7-day window replaces.
- Response `201`: `{ "accepted": true }`.
- Errors: `400` (stars out of range); `401`; `404` (unknown activity).

#### M-R2 — Check own rating
- `GET /activities/:id/my-rating`
- Backend: ❌ missing. Request body: none.
- Response `200`: `{ "has_rated": true }` (bool).
- Errors: `401`; `404`.

### 4.4 Reports

#### M-P1 — Submit report
- `POST /reports`
- Backend: ❌ route missing (Firestore `reports` collection already defined).
- Request body:
  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `target_id` | string | Yes | reported user or activity id |
  | `target_type` | enum(`user`,`activity`) | Yes | |
  | `reason` | string | Yes | user-facing reason text |
  | `details` | string | No | free-text elaboration |
- Reporter id/name derived from token. Stored as canonical `Report` (§3.6).
- Response `201`: `{ "id": "<report-id>" }`.
- Errors: `400`; `401`; `404` (unknown target).

### 4.5 Chat

**D4 (decision required):** canonical mount path. Mobile calls
`/api/activities/:id/messages*`; backend mounts
`/api/chat/messages` + `/api/chat/:activityId/messages`.
Recommendation: move to `/api/activities/:id/messages*` (zero mobile
churn), keeping `/api/chat/...` as deprecated aliases during transition.

#### M-C1 — List messages
- `GET /activities/:id/messages`
- Backend: ⚠️ exists under a different path.
- Path params: `id*`. Paginate per §2.6 (mobile currently sends none).
- Response `200`: JSON array of `ChatMessage` (§3.4, chronological).
- Errors: `401`; `403` (not a participant); `404`.

#### M-C2 — Send text message
- `POST /activities/:id/messages`
- Backend: ⚠️ path mismatch.
- Request body: `{ "text"* : string }`.
- Response `201`: the created `ChatMessage` (§3.4, `is_mine=true` for sender).
- Errors: `400` (empty text); `401`; `403`; `404`.

#### M-C3 — Send image message
- `POST /activities/:id/messages/image`
- Backend: ❌ missing.
- Request body: `multipart/form-data`, single field `image*` (binary).
  Storage + URL scheme is backend's choice; returned `image_path` must be
  fetchable by participants.
- Response `201`: `ChatMessage` with `image_path` set.
- Errors: `400` (missing/oversize file — document the limit here);
  `401`; `403`; `404`.

#### M-C4 — Send location message
- `POST /activities/:id/messages/location`
- Backend: ❌ missing.
- Request body: `{ "latitude"*: number, "longitude"*: number }`.
- Response `201`: `ChatMessage` with `latitude/longitude` set.
- Errors: `400` (out-of-range coords); `401`; `403`; `404`.

#### M-C5 — List conversations
- `GET /conversations`
- Backend: ❌ missing. Paginate per §2.6.
- Response `200`: JSON array of
  `{id*, name*, last_message?, unread_count?}`.
- Errors: `401`.

### 4.6 Notifications

Backend has `POST /`, `GET /:uid`, `PATCH /:uid/:notificationId/read`.
Mobile sends no uid (identity from token).

#### M-N1 — List notifications
- `GET /notifications`
- Backend: ❌ uid-less route missing.
- Response `200`: JSON array of `Notification` (§3.5, newest first).
- Errors: `401`.

#### M-N2 — List unread notifications
- `GET /notifications/unread`
- Backend: ❌ missing.
- Response `200`: JSON array of `Notification` with `unread=true`.
- Errors: `401`.

#### M-N3 — Mark one as read
- Legacy mobile call: `POST /notifications/:id/read`. Backend has
  `PATCH /:uid/:notificationId/read`. Align to one (recommendation:
  `PATCH /notifications/:id/read`, uid from token; keep legacy `POST`
  alias during transition — G18).
- Path params: `id*`. Request body: none. Response `200`. Errors: `401`; `404`.

#### M-N4 — Mark all as read
- `POST /notifications/read-all`
- Backend: ❌ missing. Request body: none.
- Response `200`: `{ "marked": <int> }`. Errors: `401`.

### 4.7 Calendar (module missing)

#### M-L1 — List upcoming events
- `GET /calendar/upcoming?days=30`
- Backend: ❌ missing.
- Query params: `days` (int, default 30).
- Response `200`: JSON array of `CalendarEvent` (§3.8).
- Errors: `401`.

#### M-L2 — Sync event to device calendar
- `POST /calendar/sync`
- Backend: ❌ missing.
- Request body: `CalendarEvent` (§3.8, `id` optional on create).
- Response `200`: the stored event (with server `id`).
- Errors: `400`; `401`.

### 4.8 Swipes / presence / typing

Backend implements swipes (`POST /`, `GET /:uid`, `GET /:uid/:activityId`),
presence and typing routers. Mobile has no remote callers yet — when
mobile adds them, follow this doc's conventions (§2) and register the
endpoint specs here BEFORE implementing.

---

## 5. Admin endpoints

Base (pending D1): `{VITE_API_BASE_URL}/api/v1`. Auth: D3 scheme on all
routes. **Entire namespace is ❌ missing on the backend.** All admin
lists paginate per §2.6.

### 5.1 Admin auth

#### A-A1 — Admin sign-in
- `POST /api/v1/auth/admin/sign-in`
- Request body: `{ "email"*: string, "password"*: string }`.
- Response `200`: `{ "token"*: string, "user"*: {id, name, email, role, avatar_seed} }`.
- Errors: `401 INVALID_CREDENTIALS`; `403` (valid user, not admin);
  `429` (rate-limit brute force — recommended).

#### A-A2 — Admin sign-out
- `POST /api/v1/auth/admin/sign-out` (token in header)
- Request body: none. Response `200`. Server may blacklist the token.

#### A-A3 — Current admin
- `GET /api/v1/auth/admin/me`
- Response `200`: `{id, name, email, role, avatar_seed}`. Errors: `401`.

### 5.2 Dashboard & moderation

#### A-D1 — Dashboard bundle
- `GET /api/v1/admin/dashboard`
- Response `200`:
  | Field | Type | Notes |
  |---|---|---|
  | `kpis` | array of `{title, value, raw_value, change, dir: up\|down, spark_bars[], spark_color}` | formatted `value` + numeric `raw_value` |
  | `trend` | array of `{day, activities, signups}` | last N days (query `?days`, default 7) |
  | `moderation_queue` | `ModerationItem[]` | pending-first, capped (query `?limit`, default 10) |
  | `activities` | array of `{id, name, match_id, sport, host, host_avatar_seed, participants, capacity, status, scheduled_date}` | recent/flagged slice (query `?limit`, default 10) |

#### A-D2 — Moderation queue
- `GET /api/v1/admin/moderation`
- Response `200`: array of
  `{id*, reporter*, target*, target_type*, reason*, activity_title*, sport*, created_at*}`.
  (Superset views SHOULD return the canonical `Report` §3.6; the flat
  item is accepted during transition.)

#### A-D3 — Resolve moderation item
- `POST /api/v1/admin/moderation/:id/resolve`
- Request body: `{ "note"? : string }`. Response `200`. Errors: `401`; `403`; `404`; `409` (already actioned).

#### A-D4 — Dismiss moderation item
- `POST /api/v1/admin/moderation/:id/dismiss`
- Same shape as A-D3.

**D5 (decision required):** moderation queue vs reports overlap — admin
has near-identical resolve/dismiss flows on `/admin/moderation` and
`/admin/reports` with different item shapes. Recommendation: ONE queue
backed by the canonical `Report` (§3.6); `moderation` becomes a filtered
view (`status=pending`) or is removed.

### 5.3 Activities admin

#### A-C1 — List activities (admin view)
- `GET /api/v1/admin/activities`
- Query params (all optional): `status`, `sport`, `q` (search), + §2.6 pagination.
- Response `200`: array of `AdminActivity` =
  `Activity` (§3.1) + `match_id*` (e.g. `"MU-1082"`).
  Backend returns ISO timestamps; human display strings are formatted client-side.

#### A-C2 — Update activity status
- `PATCH /api/v1/admin/activities/:id/status`
- Request body: `{ "status"*: enum(Active,Full,Completed,Cancelled,Flagged) }`.
- Response `200` (no body required; returning the updated record is accepted).
- Errors: `400` (unknown status); `401`; `403`; `404`.

#### A-C3 — Delete activity
- `DELETE /api/v1/admin/activities/:id`
- Response `200`. Soft-delete recommended; hard-delete only when the
  activity has no participants. Errors: `401`; `403`; `404`; `409` (has participants, if hard-delete enforced).

### 5.4 Members admin

#### A-M1 — List members
- `GET /api/v1/admin/members`
- Query params (all optional): `status`, `role`, `q`, + §2.6 pagination.
- Response `200`: array of `Member` = `User` (§3.2) + `username*`, `joined_date*` (ISO).

#### A-M2 — Get member
- `GET /api/v1/admin/members/:id`
- Response `200`: `Member`. Errors: `401`; `403`; `404`.

#### A-M3 — Update member status
- `PATCH /api/v1/admin/members/:id/status`
- Request body: `{ "status"*: enum(Active,Inactive,Suspended,Pending) }`.
- Response `200`. Errors: `400`; `401`; `403`; `404`.

#### A-M4 — Delete member
- `DELETE /api/v1/admin/members/:id`
- Response `200`. Deactivate + anonymise PII recommended over hard delete.
- Errors: `401`; `403`; `404`.

### 5.5 Reports admin

#### A-R1 — List reports
- `GET /api/v1/admin/reports`
- Query params (all optional): `status` (default `pending`),
  `category`, + §2.6 pagination.
- Response `200`: array of canonical `Report` (§3.6).

#### A-R2 — Resolve report
- `POST /api/v1/admin/reports/:id/resolve`
- Request body: `{ "note"? : string }`.
- Response `200`. Side effects: `status=resolved`, `admin_note=note`, `resolved_at=now`.
- Errors: `401`; `403`; `404`; `409` (already actioned).

#### A-R3 — Dismiss report
- `POST /api/v1/admin/reports/:id/dismiss`
- Same as A-R2 with `status=dismissed`.

### 5.6 Broadcasts admin

#### A-B1 — List broadcasts
- `GET /api/v1/admin/broadcasts`
- Response `200`: array of `Broadcast` (§3.9).

#### A-B2 — Create (and send) broadcast
- `POST /api/v1/admin/broadcasts`
- Request body:
  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `title` | string | Yes | |
  | `message` | string | Yes | |
  | `audience` | string | Yes | segment key, e.g. `all_users` |
  | `scheduled_at` | datetime | No | omit = send immediately |
- Response `201`: the created `Broadcast` (`status` = `sent` or `scheduled`).
- Errors: `400`; `401`; `403`.

#### A-B3 — Update broadcast (drafts)
- `PATCH /api/v1/admin/broadcasts/:id`
- Request body: partial of A-B2 (any subset). Only `draft`/`scheduled`
  broadcasts are editable.
- Response `200`: updated `Broadcast`. Errors: `400`; `401`; `403`; `404`; `409` (already sent).

#### A-B4 — Delete broadcast
- `DELETE /api/v1/admin/broadcasts/:id`
- Response `200`. Errors: `401`; `403`; `404`; `409` (already sent).

### 5.7 Analytics admin

#### A-N1 — Analytics bundle
- `GET /api/v1/admin/analytics`
- Query params: `range` = `7d | 30d | 90d` (default `7d`).
- Response `200`:
  | Field | Type | Notes |
  |---|---|---|
  | `kpis` | array of `{label, value, change}` | `value` pre-formatted (`"12,483"`, `"8m 32s"`); add `raw_value` when charting needs it |
  | `weekly` | array of `{day, signups, activities, reports}` | bucket labels depend on `range` |
  | `top_sports` | array of `{sport, activities, pct}` | |
  | `retention` | array of `{label, value}` | |
  | `health` | array of `{label, value, color}` | |

---

## 6. Gap register (implementation tracker)

Checked against api-server `main`. Update statuses as work lands.

| ID | Item | Depends on |
|---|---|---|
| G1 | D1 prefix, D2 casing, D3 admin auth decided | — |
| G2 | Conform `POST/GET /api/activities` to §3.1/§4.1 | G1 |
| G3 | Conform `GET /api/users/:uid` to §3.2 | G1 |
| G4 | Activity member routes (M-A2, M-A5–M-A8) | G2 |
| G5 | User lists + `PATCH /users/me` (M-U3–M-U6) | G3 |
| G6 | Ratings module (M-R1, M-R2) | G1 |
| G7 | `POST /reports` + canonical model §3.6 | G1, D5 |
| G8 | Chat path decision D4 + M-C3–M-C5 | G1, D4 |
| G9 | Notifications uid-less routes (M-N1, M-N2, M-N4) + align M-N3 | G1 |
| G10 | Calendar module (M-L1, M-L2) | G1 |
| G11 | Admin auth (A-A1–A-A3) + `requireAdmin` | D3 |
| G12 | Admin dashboard + moderation (A-D1–A-D4) | G11, D5 |
| G13 | Admin activities/members (A-C1–A-C3, A-M1–A-M4) | G11 |
| G14 | Admin reports (A-R1–A-R3) | G7, G11 |
| G15 | Admin broadcasts (A-B1–A-B4) | G11 |
| G16 | Admin analytics (A-N1) | G11 |
| G17 | Admin-web `api.ts` auth injection + remove demo creds | D3 |
| G18 | Mobile: migrate legacy `POST /notifications/:id/read` → `PATCH` | G9 |

## 7. Currently implemented (backend, for reference)

`POST /api/activities`, `GET /api/activities/:activityId`,
`POST /api/users`, `GET /api/users/:authUid`,
`POST /api/chat/messages`, `GET /api/chat/:activityId/messages`,
`POST /api/swipes`, `GET /api/swipes/:uid`, `GET /api/swipes/:uid/:activityId`,
`POST /api/notifications`, `GET /api/notifications/:uid`,
`PATCH /api/notifications/:uid/:notificationId/read`,
presence + typing routers. All Firestore-backed, Firebase-Auth protected.
