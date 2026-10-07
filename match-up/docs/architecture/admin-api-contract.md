# Admin API Contract (`/api/admin/*`)

Admin-web ↔ api-server contract for the moderation dashboard. All routes
require a Firebase ID token **and** admin rights:
`401 UNAUTHORIZED` without a token, `403 FORBIDDEN` for non-admins or
suspended accounts. Envelope is always `{ ok: true, data }` or
`{ ok: false, error: { code, message } }`.

> Admin source: Firestore `admins/{uid}` doc (managed in Firebase
> Console, no restart) with `ADMIN_UIDS` env as bootstrap fallback.

> Namespace note: there is deliberately **no `/v1`** — the backend never
> had versioning (`/api/*` everywhere). The old `/api/v1/admin/*` paths in
> admin-web comments never existed server-side and are gone.

## Auth

| Method & path | Purpose |
|---|---|
| `GET /api/admin/me` | Login gate — proves the token belongs to an admin (`{ uid, email, admin: true }`) |

Admin-web signs in with the Firebase JS SDK (same IdP as mobile) and stores
the ID token as `admin_id_token`. No password endpoint exists by design.

## Members

| Method & path | Notes |
|---|---|
| `GET /api/admin/members?limit=` | 1–100, default 20. No counts (keeps the list cheap) |
| `GET /api/admin/members/summary` | Collection-wide `{ total, active, suspended }` via count aggregation (header cards) |
| `GET /api/admin/members/:uid` | Detail + live `activitiesCount`/`hostedCount` |
| `PATCH /api/admin/members/:uid/status` | `{ status: 'active' \| 'suspended' }` — allowlisted, nothing else writable |
| `DELETE /api/admin/members/:uid` | Auth account + user doc + email index |

`suspended` is enforced in `requireAuth` (403 `FORBIDDEN` / `Account
suspended`) on every request. Docs without a `status` field read as
`active`. Frontend display states `Inactive`/`Pending` are mock-only.

## Activities
| Method & path | Notes |
|---|---|
| `GET /api/admin/activities?limit=` | Newest-first, host names best-effort |
| `GET /api/admin/activities/summary` | Collection-wide `{ total, open, full, cancelled, completed, removed }` via count aggregation (header cards) |
| `PATCH /api/admin/activities/:id/status` | `open \| cancelled \| completed \| removed` (`removed` = hidden everywhere) |
| `DELETE /api/admin/activities/:id` | Doc only — subcollections stay orphaned (no Firestore cascade) |

Frontend maps `removed ⇄ Flagged` and computes `Full` live
(`participantCount >= capacity`).

## Suspension signal

A suspended account gets `403 { code: ACCOUNT_SUSPENDED }` on every
gated request (distinct from generic `FORBIDDEN`, e.g. host-only
actions). Tokens stay valid on purpose so the account can still reach
the suspension-safe appeals endpoints below. Mobile gates to a
`/suspended` interstitial on that code and re-probes with
`GET /api/users/me` ("Check again": 200 = reactivated).

## Appeals (`appeals` collection)

| Method & path | Notes |
|---|---|
| `POST /api/appeals` | `{ type, statement, relatedId? }` — suspension-safe: uses `requireAuthAllowSuspended` so a suspended user can still appeal (their only API recourse). One pending appeal per type (409 on dupes) |
| `GET /api/appeals/me` | Caller's own appeals, newest-first (also suspension-safe) |
| `GET /api/admin/appeals?status=` | Triage board, default `pending` |
| `POST /api/admin/appeals/:id/approve { note? }` | Auto-actions: suspension/account_ban → account reactivated; activity_removal → activity reopened when still `removed` |
| `POST /api/admin/appeals/:id/reject { note? }` | Records the decision only |

Double decisions are 409. Every decision also sends the appellant a
`system` notification (their only channel back while suspended).
Frontend maps `suspension ⇄ Suspension`,
`activity_removal ⇄ Activity Removal`, etc. Mobile mirrors the flow in
`features/appeals` (interstitial + one-shot form + status + re-probe).

## Broadcasts (`broadcasts` collection)

| Method & path | Notes |
|---|---|
| `GET /api/admin/broadcasts` | Newest-first |
| `POST /api/admin/broadcasts` | `{ title, message, audience, scheduledAt? }` → `draft`/`scheduled` |
| `PATCH /api/admin/broadcasts/:id` | Content fields only; sent rows immutable (409) |
| `DELETE /api/admin/broadcasts/:id` | Draft/scheduled only (409 when sent) |
| `POST /api/admin/broadcasts/:id/send` | One-way → `sent`; fans out `system` notifications, records delivered count |

Audiences: `All Users` / `Hosts Only` (distinct hostIds) / `Players Only`
/ `Inactive Users` (created > 30d ago). Fan-out capped at 500 recipients,
per-recipient best-effort.

## Sports (`sports` collection, seeded)

| Method & path | Notes |
|---|---|
| `GET /api/admin/sports` | Config + live `activityCount`, sorted |
| `PATCH /api/admin/sports/:id` | Boolean flags only |
| `PUT /api/admin/sports` | Atomic full publish `{ sports: [...] }` (≤100, unique lowercase ids) |

Future source of truth for the mobile pickers (still hardcoded client-side).

Public read mirror: `GET /api/public/sports` (no auth — config is
non-sensitive) returns enabled rows without counts; mobile onboarding,
filter, and create/edit screens select per-surface subsets and keep
bundled fallbacks offline.

## Notification templates (`notificationTemplates` collection, seeded)

| Method & path | Notes |
|---|---|
| `GET /api/admin/templates` | By trigger |
| `PATCH /api/admin/templates/:id` | `{ title?, body?, enabled? }` |

Wired senders (`{{variables}}` filled, hardcoded fallback when missing or
disabled): `activity.joined` (host on join), `activity.cancelled`
(participants on host-cancel), `account.suspended` + `account.reactivated`
(status changes), `account.welcome` (new signups),
`moderation.report_resolved` (reporter on resolve),
`moderation.appeal_approved` + `moderation.appeal_rejected` (appellant on
decision, with `{{adminNote}}`). A broadcast-due sweeper (60-min
interval) now sends due scheduled broadcasts; `activity.reminder`,
`activity.starting_soon`, and the `engagement.*` triggers remain curated
but unfired (no per-participant reminder scheduler yet). The admin UI
marks those triggers "Inactive".

## Analytics (read-only, bounded)

| Method & path | Notes |
|---|---|
| `GET /api/admin/analytics?range=7d\|30d\|90d` | Daily buckets, deltas vs previous window, top-5 sports; `retention`/`health` empty (no backing events yet) |
| `GET /api/admin/dashboard` | `{ totalUsers, activeActivities, pendingReports, newUsersWeek, topSports }` |

Scans capped at 1000 docs — exact on small data, approximations at scale.

## Mock-only pages (no backend, by decision)

Settings page was **deleted** (no backend planned). Audit Log is live
(`GET /api/admin/audit-log` + AuditLogPage wired in navigation).
Everything else — Members, Activities, Appeals, Reports, Dashboard,
Broadcasts, Analytics, Sports, Notification Templates — is live-capable
via `VITE_USE_MOCK_API=false`.
