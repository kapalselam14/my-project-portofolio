# Testing Strategy

Testing is a first-class concern: CI fails the build on test failures, and
every layer below runs there — not as an afterthought.

## Pyramid

```
            ┌──────────────┐
            │  On-device / │  emulator + physical runs, hot-restart
            │  manual      │  loops, permission/location matrices
            ├──────────────┤
            │  Widget      │  ~70 flutter_test suites: screens,
            │  (Flutter)   │  navigation, sheets, error states
            ├──────────────┤
            │  Unit        │  Flutter unit (repos, models, geo) +
            │              │  35 vitest suites (services, middleware,
            │              │  rate-limit, contracts)
            ├──────────────┤
            │  Performance │  `npm run perf:smoke` — p50/p95 budgets
            │  smoke       │  on a live server (see below)
            └──────────────┘
```

## Backend — vitest + supertest (35 suites)

- Run: `cd apps/api-server && npm test` (`vitest run`).
- Services are tested against stateful in-memory fakes (e.g. the RTDB fake
  in `dm-inbox.service.test.ts`), so suites are hermetic — no emulator, no
  network, deterministic in CI.
- Middleware has dedicated suites (`rate-limit.test.ts`,
  `require-admin.test.ts`, `auth.middleware.test.ts`) because auth and
  throttling are load-bearing for moderation.
- Route tests assert the `{ ok, data } / { ok, error: { code } }` envelope,
  including `RATE_LIMITED` (429), `ACCOUNT_SUSPENDED` (403), and
  `VALIDATION_ERROR` (400) paths.
- `app.test.ts` asserts the global limiter headers (`RateLimit-Limit: 300`).

## Mobile — flutter_test (~70 suites)

- Run: `cd apps/mobile && flutter test`.
- **Unit:** repositories (with `debug*` overrides instead of platform
  channels, e.g. `LocationService.debugGetCurrentLocation`), models,
  haversine/geohash math, interceptors.
- **Widget:** every major screen pumps through `go_router` with faked
  providers — splash routing, onboarding flow, discovery deck, chat
  (incl. photo/location/error states), DM, check-in, recovery screens.
  Timers are drained explicitly (`pump(Duration)`) so suites never hang
  on debounce/timeout logic.
- `flutter analyze` (via `flutter_lints`) must be clean; CI-equivalent
  discipline is to run it before every PR.

## CI — `.github/workflows/ci.yml`

Runs on every push/PR to `main`: admin-web lint + build (+ `npm audit`
gate), api-server `npm test` + coverage gate + build, mobile
`flutter analyze` + `flutter test --coverage` + line-coverage gate (awk,
no extra tooling), plus the secrets guard. Concurrency cancels
superseded runs. Dependabot files weekly update PRs for npm + pub.

## On-device testing

- Primary matrix: Android emulator (API 34+, `EGL_emulation` logs in this
  repo's `.logs/` are from these runs) + physical devices for GPS, camera,
  and push — capabilities that emulators only approximate.
- Verified on-device behaviours: mock-location discover flow, camera +
  gallery attachments, FCM foreground/background
  taps → deep links, minimise → instant warm resume, kill → route restore
  via `RouteStore`.
- Permission matrices are exercised manually: denied / deniedForever /
  services-disabled for location, camera, and calendar — every service
  degrades to `null` + user-facing message, never a crash
  (see `location_service.dart`, `calendar_service.dart`).

## Performance smoke — `npm run perf:smoke`

`apps/api-server/src/scripts/load-smoke.ts` (dependency-free, Node 20+)
fires a fixed request mix at a running server (default
`http://localhost:4000`) with bounded concurrency and asserts latency
budgets:

| Default budget | Value |
|---|---|
| Requests | 100 @ concurrency 10 |
| p95 `GET /api/health` | < 1000 ms |
| Socket / timeout errors | 0 |

Usage:

```bash
cd apps/api-server
npm run dev &          # or point at staging
API_BASE_URL=https://staging.example.com npm run perf:smoke
```

Exit code is non-zero when a budget is breached, so it can gate deploys.

## Load testing — `infra/perf/k6-auth-flow.js`

Graduates the smoke to realistic traffic with k6 (not installed by
default — see the script header): ramp 5 → 20 VUs over 2 minutes across
liveness, public catalog, and authenticated reads (profile, discover
feed, chat history; writes excluded so runs never pollute data).
Budgets: p95 < 800 ms per endpoint class, error rate < 1%. Needs
`API_BASE_URL` + `API_ID_TOKEN` (test user) + `ACTIVITY_ID`; run
against staging, never production data.
