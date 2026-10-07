# Architecture Overview

MatchUp is a single-repository monorepo containing three applications that
share typed contracts via local `packages/`.

> Status note: this document describes the system **as built**. The
> boilerplate-phase text (placeholder auth) it replaced is
> superseded below; phase history remains in `docs/initial-plan.md`.

## Applications

```
┌─────────────────────────────────────────────────────────┐
│                         Clients                          │
├──────────────────────────┬──────────────────────────────┤
│   Mobile (Flutter)       │   Admin web (React + Tailwind)│
│   apps/mobile            │   apps/admin-web               │
└───────┬──────────────────┴────────────┬──────────────────┘
        │ HTTPS (REST/JSON envelope)     │
        ▼                                ▼
┌─────────────────────────────────────────────────────────┐
│         API (Node.js + Express 5 + TypeScript)           │
│                    apps/api-server                      │
│   requireAuth / requireAdmin · rate limiting · zod env   │
└───────┬────────────────────────────────┬────────────────┘
        │ Admin SDK (bypasses rules)     │
        ▼                                ▼
┌──────────────────┐          ┌──────────────────────────┐
│ Firestore        │          │ RTDB (realtime reads)    │
│ profiles,        │          │ chat · typing · presence │
│ activities,      │          └──────────────────────────┘
│ swipes, reports, │          ┌──────────────────────────┐
│ moderation       │          │ FCM push → devices       │
└──────────────────┘          └──────────────────────────┘
```

Protocol choices and their rationale live in
[`adr-001-protocols.md`](./adr-001-protocols.md); scaling in
[`scalability.md`](./scalability.md); testing in
[`testing-strategy.md`](./testing-strategy.md); security in
[`../security/owasp-top-10.md`](../security/owasp-top-10.md).

### Mobile (`apps/mobile`)

- **Framework:** Flutter (Dart 3, Material 3), Android + iOS from one codebase.
- **State:** `flutter_riverpod` (providers per feature, session-lived filter/deck state).
- **Routing:** `go_router` with a bottom-nav `ShellRoute`; last route persisted in `RouteStore` for kill-restore.
- **HTTP:** `dio` with auth interceptor, envelope parsing, and session-expiry/suspension events.
- **Realtime:** `firebase_database` listeners (chat, typing, presence reads) authenticated via custom token (`RtdbAuthService`); HTTP polling fallback when Firebase is unconfigured.
- **Push:** `firebase_messaging` (foreground banners + background/killed deep links via `routeForPush`).
- **Capabilities:** GPS (`geolocator`) + OSM maps (`flutter_map`), camera/gallery (`image_picker`), device calendar, share sheet, Tinder-style swipe deck gestures.
- **Local storage:** `flutter_secure_storage` (tokens/PII) + `SharedPreferences` (route, prefs) + Hive (form drafts).
- **Tests:** ~70 `flutter_test` suites (unit + widget); `flutter_lints` clean.

### Admin web (`apps/admin-web`)

- **Framework:** React + Vite + Tailwind CSS.
- **Routing:** `react-router-dom` (dashboard, members, activities, appeals, reports, sports, broadcasts, notifications, analytics, login).
- **HTTP:** native `fetch` wrapped in `services/api.ts` against the same `/api` with the same envelope.
- **Role:** the moderation cockpit for admin users — member suspension, appeals adjudication, reports triage, sports/templates/broadcast curation. Contract: `admin-api-contract.md`.

### API (`apps/api-server`)

- **Runtime:** Node.js 20+, TypeScript (strict) via `tsx`/`tsc`.
- **Framework:** Express 5 with `helmet`, `cors`, `morgan`, JSON body cap (1 MB).
- **Structure:** feature modules `src/modules/<feature>/{routes,controller,service}` + `src/middleware/*` + `src/database/*`.
- **Auth:** `requireAuth` (Firebase ID token + suspension enforcement) and `requireAdmin` (admin claim); suspension-safe variants for appeals.
- **Validation:** `zod` for env config (refuses to boot when invalid); per-controller `400 INVALID_INPUT` checks on mutating endpoints.
- **Throttling:** per-IP fixed-window global limiter (300 req / 15 min) + tighter burst caps (`/api/typing`, places autocomplete).
- **Data:** Firestore (Admin SDK) for domain state; RTDB (Admin SDK) for authorised chat/typing/presence writes; FCM for per-device push.
- **Contracts:** `mobile-api-contract.md`, `admin-api-contract.md` (both under `docs/architecture/`).
- **Tests:** 35 vitest + supertest suites (420 tests), hermetic via in-memory fakes; `npm run perf:smoke` latency budgets.

## Shared packages

```
packages/
├── shared-types/    # enums, DTOs, common response types
├── shared-config/   # prettier / tsconfig / eslint base
└── shared-utils/    # small reusable helpers (string, date)
```

## Boundary rules

- **Clients never write domain state directly.** All mutations go through API endpoints, except the single owner-scoped RTDB primitive: a user's own `presence/{uid}` `onDisconnect` dead-man's switch (rule-pinned to `auth.uid == $uid` and a fixed schema).
- **Realtime reads bypass the API by design.** Chat/typing/presence streams flow client↔RTDB over websockets (`.write: false` rules); per-activity authorisation is enforced on every backend write and on history endpoints.
- **The API never trusts client-asserted identities.** Every request carries a verifiable Firebase ID token; Firestore itself is default-deny to all client SDKs.
- **Storage writes are rule-gated, not API-proxied.** Profile/activity/chat uploads go through the SDK under owner/host-scoped, type- and size-capped rules (`storage.rules`).
- **Shared types are additive.** Removing or renaming a type requires a coordinated change in every consumer; prefer adding new types and deprecating old ones.

## Deployment

```
Mobile APK ──┐
             ├─ HTTPS/REST ─► Cloud Run `matchup-api` (asia-southeast1, Secret Manager)
Admin web ───┘   (Vercel)                │
                                         └──▶ Firebase matchup-cs734 (Firestore + RTDB + Storage + FCM)
```

Live URLs are listed in the README. Mobile APKs are built with
`flutter build apk --obfuscate --split-debug-info=build/debug-info`.

## What is in place

- Single-repo structure with `apps/`, `packages/`, `infra/`, and `docs/`
- Local development environment for mobile, admin web, and API (`docs/setup/`)
- Real Firebase Auth (REST + custom-token RTDB sessions + secure local session)
- Activity discovery / matchmaking (swipe deck, filters, geo), reporting & moderation (suspension, appeals, reports triage)
- Realtime chat (group + DM), typing indicators, presence, push notifications
- Production Firebase rules (Firestore deny-all, RTDB least-privilege, Storage scoped) + indexes
- GitHub Actions CI (admin-web lint/build, api-server tests) + mobile suite run locally
- Docs: README, setup guides, API contracts, ADR, scalability, testing strategy, OWASP map, coding standards
