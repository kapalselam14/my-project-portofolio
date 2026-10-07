# OWASP Top 10 (2021) — MatchUp Coverage Map

How each OWASP Top 10 risk is addressed in this project. File references are
relative to the repo root. Anything marked **Gap / accepted risk** is a
conscious trade-off, not an oversight.

## A01 — Broken Access Control

- **Every API route is authenticated by default.** `requireAuth` verifies the
  Firebase ID token and enforces suspension (`ACCOUNT_SUSPENDED` 403);
  `requireAdmin` gates all `/api/admin/*` routes.
  (`apps/api-server/src/middleware/auth.middleware.ts`,
  `apps/api-server/src/modules/admin/*.routes.ts`)
- **Firestore is default-deny for all client SDKs** (`firestore.rules`).
  `users/{uid}.status` can only change via `PATCH /api/admin/members/:uid/status`,
  so a suspended user cannot clear their own flag with any client token.
- **RTDB rules are least-privilege:** `.write: false` everywhere except a
  user's own `presence/{theirUid}` node (`auth.uid == $uid`, schema-validated);
  all chat/typing writes go through the backend where membership
  (`canAccessActivityChat`, host/participant checks) is verified in code.
  (`infra/firebase/database.rules.json`, `infra/firebase/README.md`)
- **Storage rules** are owner/host-scoped with type + size caps
  (`storage.rules`) — chat attachments live at
  `uploads/chat-attachments/{scope}/{uid}/…` so only the uploader can
  write/delete (legacy flat paths are read-only).
- Accepted risk: RTDB *reads* are "any authenticated user" (RTDB rules cannot
  query Firestore for per-activity membership). Per-activity authorisation is
  enforced on every write and on history endpoints; chat content between
  activity members is low-sensitivity. Documented in
  `infra/firebase/README.md`.

## A02 — Cryptographic Failures

- **Tokens never touch insecure storage.** Mobile keeps ID/refresh tokens and
  the uid in `flutter_secure_storage` (Keychain on iOS, Keystore-backed
  encrypted prefs on Android) — never `SharedPreferences`/Hive.
  (`apps/mobile/lib/core/storage/secure_token_store.dart`)
- **HTTPS enforced outside local dev.** `Env.assertHttpsOutsideLocal` fails
  fast on cleartext `API_BASE_URL` when `APP_ENV != local`, backed by
  Android's network security config (`usesCleartextTraffic="false"`) and iOS
  ATS. (`apps/mobile/lib/core/config/env.dart`,
  `apps/mobile/android/app/src/main/res/xml/network_security_config.xml`)
- Passwords are handled by Firebase Auth (REST); the backend never sees,
  stores, or logs them. Bearer tokens are redacted in mobile API logs.

## A03 — Injection

- **No string-concatenated queries.** All Firestore/RTDB access uses the
  Admin SDK with path helpers (`apps/api-server/src/database/paths.ts`);
  there is no SQL in the stack.
- **Input validation on every mutating endpoint:** reusable
  `validateBody(schema)` zod middleware (`middleware/validate.ts`,
  piloted on `POST /api/chat/messages` via `chat.schema.ts`) rejects
  malformed bodies with `400 INVALID_INPUT` + per-field `details`;
  remaining controllers enforce non-blank checks the same way, and env
  config is schema-validated with zod (the process refuses to boot on
  invalid config in `config/env.ts`).
- RTDB `presence/$uid` writes are schema-validated server-side by security
  rules (`.validate`: `state ∈ {online, offline}`, numeric `lastChanged`).
- Uploads are content-typed and size-capped in `storage.rules`
  (images ≤ 5–8 MB); the JSON body parser caps payloads at 1 MB
  (`app.ts` → 413 `PAYLOAD_TOO_LARGE`).

## A04 — Insecure Design

- **Abuse cases designed in:** per-IP fixed-window rate limiting globally
  (1200 req / 15 min) plus tighter burst caps on abuse-prone routes
  (`/api/typing` 120/min, places autocomplete 60/min per Nominatim policy).
  (`apps/api-server/src/middleware/rate-limit.ts`)
  `trust proxy: 1` is set so `req.ip` is the real client IP behind the
  Cloud Run front-end — without it all clients share one bucket.
  (`app.ts`)
- **Moderation is unbypassable by design:** suspension is enforced in
  `requireAuth` on *every* request (not just UI gating); Firestore deny-all
  makes client-side circumvention impossible; appeals are the single
  suspension-safe recourse (one pending appeal per type, 409 on dupes).
  (`docs/architecture/admin-api-contract.md`)
- Match/attendance flows keep server-side truth (presence, swipes, check-in
  windows) so clients cannot forge state.

## A05 — Security Misconfiguration

- `helmet` secure headers + restrictive CORS (allowlist via `CORS_ORIGINS`;
  the server **refuses to boot in production** when it is unset — local/dev
  keeps the permissive default with a loud warning). (`app.ts`)
- Admin web ships hardening headers from `vercel.json` (tight CSP,
  `frame-ancestors 'none'` + `X-Frame-Options: DENY`, nosniff,
  strict referrer).
- Firebase native configs (`google-services.json`, `GoogleService-Info.plist`)
  and `.env` files are gitignored; only `.env.example` files are committed.
- Error middleware always returns the `{ ok, error: { code, message } }`
  envelope — stacks stay in server logs, never leak to clients (`app.ts`).
- Debug-only logging is gated behind `kDebugMode` on mobile.

## A06 — Vulnerable & Outdated Components

- Dependencies are pinned via lockfiles (`package-lock.json`, `pubspec.lock`).
- CI installs with `npm ci` and gates on `npm audit --omit=dev
  --audit-level=high` (production tree — what ships) for both npm apps,
  plus the full mobile analyze/test suite, on every push/PR
  (`.github/workflows/ci.yml`).
- Resolved in-repo: `js-yaml` + `nanoid` highs via `npm audit fix`;
  `react-router-dom` 6.30 → 7.18 to clear the high open-redirect/SSR
  advisories (admin usage is basic routing — `createBrowserRouter`,
  `Link`, `useNavigate` — verified via lint + build).
- Accepted risk (documented, not ignored): the remaining high is a
  **dev-only** vite dev-server advisory (`server.fs.deny` bypass,
  Windows paths), patchable only via a breaking vite 5→8 jump. Vite
  never ships to browsers, so the gate scopes to `--omit=dev`; revisit
  on the next planned toolchain upgrade.
- Remaining gap: `flutter pub outdated` is not yet gated in CI (Dependabot
  covers pub updates as PRs, but nothing fails the build on a stale
  Flutter dep).

## A07 — Identification & Authentication Failures

- Firebase ID tokens verified server-side on every request **with
  revocation checking** (`verifyIdToken(token, true)`); short-lived
  custom tokens mint the RTDB session (`POST /api/users/custom-token`).
- Suspension revokes sessions at enforcement time
  (`revokeRefreshTokens` in `setMemberStatus`, best-effort with the
  per-request revocation check as second layer), so a suspended user
  loses API *and* RTDB/presence access immediately — not at token
  expiry. (`members.service.ts`, `auth.middleware.ts`)
- Admin web keeps its stored token fresh: `onIdTokenChanged` subscription
  persists hourly SDK refreshes and a one-shot rehydration runs on
  reload, so the 8h/30d session TTLs are real instead of dying at the
  1-hour ID-token expiry. (`authService.ts`, `AuthContext.tsx`)
- Client handles session lifecycle first-class: expired refresh tokens flip
  to unauthenticated (forced re-login, no zombie 401 loops); suspended
  accounts keep tokens only for the appeals flow.
  (`auth_state_provider.dart`, `api_client.dart`, `rtdb_auth_service.dart`)
- Session tokens live in Keychain/Keystore (`SecureTokenStore`) and are
  never used as a substitute for server-side verification — every request
  is re-verified via `verifyIdToken`.
- Admin web uses the same token scheme against the same API (no second,
  weaker auth path).

## A08 — Software & Data Integrity Failures

- No client-supplied code, deserialisation gadgets, or remote updates are
  executed; CI builds from locked dependencies.
- RTDB `onDisconnect` presence handlers only ever write a fixed
  `{state: 'offline', lastChanged}` shape the client cannot parametrise
  beyond its own uid.
- Gap: release builds are not yet signed/pinned with certificate pinning —
  acceptable for the course threat model (physical-attacker out of scope).

## A09 — Security Logging & Monitoring Failures

- HTTP access log (`morgan`) + structured API error log server-side;
  envelope error codes (`RATE_LIMITED`, `ACCOUNT_SUSPENDED`,
  `VALIDATION_ERROR`, …) make abuse visible without log scraping.
- Mobile logs auth/presence failures with tags (`[RtdbAuthService]`,
  `[RemotePresenceRepository.*]`) for on-device diagnosis.
- Gap: no centralised alerting (e.g. 429-spike alarms) — recommended when
  moving beyond a single instance (see `docs/architecture/scalability.md`).

## A10 — Server-Side Request Forgery (SSRF)

- The server makes no outbound requests on behalf of clients except the
  places-autocomplete proxy, which calls a fixed Nominatim base URL with
  user input confined to query parameters (never the host/path).
  Rate-limited to 60 req/min per IP per upstream policy.
  (`apps/api-server/src/modules/places/`)
