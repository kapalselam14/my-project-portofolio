# MatchUp

> Activity-based matchmaking platform for connecting people through shared sports — think Tinder-style swiping, but for finding games to join or host instead of dating.

This repository contains the **source code** for the MatchUp platform: a cross-platform **mobile app (Flutter)**, a moderation **admin web (React + Tailwind)**, and a shared **backend API (Node.js + Express + TypeScript)**, backed by **Firebase** (Auth, Firestore, Realtime Database, Storage, FCM push). It is the team project for **COMPSCI 734 — Mobile, Web & Enterprise Computing** (Semester 2, 2026).

## Contents

- [Live Deployment](#live-deployment)
- [What is MatchUp?](#what-is-matchup)
- [Users](#users)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Installation](#installation)
- [Demo Accounts](#demo-accounts)
- [Scripts by App](#scripts-by-app)
- [Testing](#testing)
- [Security](#security)
- [Configuration](#configuration)
- [Common Issues](#common-issues)
- [Documentation](#documentation)
- [Team — Nimble Takahe](#team--nimble-takahe)

## Live Deployment

| Component | Live URL | Notes |
|-----------|----------|-------|
| Admin web (React) | <https://matchup-hosting.vercel.app/> | Hosted on Vercel; hardening headers (CSP, `X-Frame-Options: DENY`) ship from [`apps/admin-web/vercel.json`](apps/admin-web/vercel.json). Admin login requires an admin uid (see [Demo Accounts](#demo-accounts--seed-data)). |
| API (Express) | <https://matchup-api-569237066208.asia-southeast1.run.app/> — health: [`/api/health`](https://matchup-api-569237066208.asia-southeast1.run.app/api/health) | Cloud Run service `matchup-api` in `asia-southeast1` (project `matchup-cs734`); secrets via Secret Manager. Deploy script: [`apps/api-server/deploy-cloudrun.sh`](apps/api-server/deploy-cloudrun.sh). |
| Mobile (Flutter) | APK: [Google Drive folder](https://drive.google.com/drive/u/0/folders/1xdP49GI5ip-Ca7zjh3ZbHAYM1aj1QZSD) | Release build (`flutter build apk --obfuscate --split-debug-info=build/debug-info`), points at the live API + Firebase project `matchup-cs734`. |
| Data plane | Firebase project `matchup-cs734` (Firestore + RTDB + Storage + FCM) | Rules in [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules), [`infra/firebase/database.rules.json`](infra/firebase/database.rules.json). |

## What is MatchUp?

Finding people for a casual sports game is hard: group chats are chaotic, skill levels mismatch, and venues/times never line up. MatchUp fixes this with an **activity-based matchmaking loop**:

**Onboard → set sports/skill/distance preferences → swipe the Discover deck → join instantly (or request approval) → group chat → play → rate each other.** Hosts create games through a guided wizard (venue autocomplete, cover photo, free/fixed/split-cost pricing, draft autosave), manage rosters and join requests, run check-ins, and collect post-game ratings.

Moderation keeps the community safe: any user can report a user/activity, admins triage reports, suspend members, and handle appeals — all from the admin web.

## Users

| User | App | Goals |
|------|-----|-------|
| **Players** | Mobile | Discover nearby games matching their sports/skill, swipe to join, chat with the group, get reminded, rate hosts/players |
| **Hosts** | Mobile | Create and publish games, approve join requests, manage the roster, run check-in, see ratings |
| **Admins** | Admin web | Moderate members/activities, triage reports, adjudicate appeals, curate sports catalogue and broadcasts, view analytics |

Typical journeys: first run (splash → onboarding → Get-to-Know preferences → first-run tour on Discovery) · returning user (session resume → last route restored) · discover → play (filters → swipe → instant join or approval flow → match screen → group chat) · host (wizard → roster/requests → check-in → ratings) · moderation (report → suspend → appeal → reactivate) · re-engagement (FCM push → deep link to the exact screen).

## Features

### Mobile (`apps/mobile`)

- **Onboarding & preferences** — 3-page onboarding, Get-to-Know wizard (join reason, sports × skill levels, distance, physical profile), first-run coach-mark tour, dark-mode theming.
- **Discovery** — Tinder-style swipe deck (drag gestures, LIKE/NOPE stamps), filters (sport/skill/date/distance), venue map cards, session-lived filter state with offline-tolerant sports config.
- **Activities** — 3-step create wizard (setup → rules → preview) with venue autocomplete, cover photo, pricing (free / fixed / split-cost), Hive draft autosave; My Games (hosted/joined/past/pending); join-request approval flow; GPS check-in; post-game 1–5 ratings.
- **Chat** — realtime group chat + 1-on-1 DMs over RTDB with HTTP-polling fallback, photo/location attachments, polls, emoji reactions, typing indicators, presence, photo-moments album.
- **Notifications** — FCM foreground banners + background/killed deep-link routing, per-type notification feed, push toggles.
- **Profile, reports, appeals, calendar** — editable profile, user/activity reporting, suspension interstitial with one-pending-appeal flow, device-calendar sync.
- **Mobile capabilities used** — GPS (`geolocator`) + offline haversine/geohash, camera/gallery (`image_picker` + compression), interactive OSM maps (`flutter_map`), push (`firebase_messaging`), device calendar, share sheet, swipe gestures, secure token storage (Keychain/Keystore), HTTPS enforcement (Env guard + Android network security config + iOS ATS).

### Admin web (`apps/admin-web`)

Moderation cockpit (all routes behind admin-gated login except `/login`): **Dashboard** (KPIs, trends, moderation queue) · **Members** (search, suspend/reactivate/delete, CSV export, detail) · **Activities** (status control, delete) · **Reports** (triage Pending/Resolved/Dismissed, bulk actions) · **Appeals** (approve/reject with note, auto-reactivation) · **Broadcasts** (draft/schedule/send) · **Sports** catalogue curation · **Notification templates** · **Analytics** (7/30/90-day) · **Audit log**.

### Backend (`apps/api-server`)

Feature modules under `src/modules/<feature>/{routes,controller,service}`: `activities` (CRUD, discover with geo filters, participants, join-requests, check-in, ratings), `swipes`, `chat` (messages, reactions, polls), `dm`, `users` (bootstrap, profile, custom-token), `devices` (FCM registry), `notifications` (persist-first + best-effort push), `presence`, `typing`, `places` (Nominatim autocomplete proxy), `reports`, `appeals`, `admin` (dashboard, members, activities, sports, broadcasts, templates, analytics, appeals). Cross-cutting: Firebase-ID-token auth + suspension/admin gates, per-IP rate limiting (global 1200/15 min; typing 120/min; autocomplete 60/min), 1 MB JSON cap, uniform `{ok,data}/{ok,error:{code}}` envelope, zod env + per-route validation. Data: Firestore (profiles, activities, swipes, reports, moderation) via Admin SDK; RTDB (chat, typing, presence) for realtime fan-out; FCM per-device push with dead-token pruning.

## Architecture

```
Mobile (Flutter) ──┐
                    ├─ HTTPS/REST (/api envelope) ─▶ Express API (stateless) ─▶ Firestore (domain state)
Admin web (React) ──┘                                        │                    └▶ RTDB (realtime reads)
                                                             └─ Admin SDK ────────┘
FCM push ◄── API writes device tokens + Firestore-sourced notifications
```

| Channel | Protocol | Used for |
|---|---|---|
| Client → API | HTTPS REST + JSON envelope | All CRUD, auth, admin, moderation, swipes |
| Client ↔ RTDB | Firebase RTDB over websockets | Chat streams, typing indicators, presence reads |
| Server → devices | FCM push | Match/join/message notifications incl. killed state |
| Server → Nominatim | HTTPS proxy (fixed host, cached, rate-limited) | Venue autocomplete |

Full rationale (including rejected GraphQL/raw-socket alternatives), scaling model, and contracts: [`adr-001-protocols.md`](docs/architecture/adr-001-protocols.md) · [`scalability.md`](docs/architecture/scalability.md) · [`mobile-api-contract.md`](docs/architecture/mobile-api-contract.md) · [`admin-api-contract.md`](docs/architecture/admin-api-contract.md).

Why two frontends? They serve **different users**: players/hosts live in the mobile app (discovery, play, chat on the go); admins work in the web dashboard (triage queues, bulk moderation, analytics on a big screen). Both talk to the same API with the same envelope.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Mobile | Flutter 3.44.8 (pinned in CI) · Dart 3 · Material 3 · Riverpod · go_router · Dio · Hive/SharedPreferences/flutter_secure_storage · Firebase (core/auth/messaging/database/storage) · flutter_map · geolocator · image_picker · device_calendar · share_plus |
| Admin web | React 19 · Vite 8 · Tailwind CSS 3 · react-router-dom 7 · Firebase Auth SDK 12 · Vitest 5 |
| API | Node.js 22 (CI) · Express 5 · TypeScript (strict) · helmet/cors/morgan · zod 4 · firebase-admin 14 · Vitest 5 + Supertest |
| Cloud | Firebase `matchup-cs734` (Firestore + RTDB + Storage + FCM, `asia-southeast1`) · Cloud Run (`matchup-api`) · Vercel (admin web) |
| Workflow | GitHub Actions CI (lint/build/test/audit/coverage/secrets-guard) · Dependabot · feature-branch PRs |

## Repository Structure

```
matchup/
├── apps/
│   ├── mobile/                  # Flutter mobile app
│   ├── admin-web/               # React + Tailwind admin dashboard
│   └── api-server/              # Node.js + Express backend (Firebase)
├── packages/
│   ├── shared-types/            # shared enums, DTO placeholders, constants
│   ├── shared-config/           # eslint, prettier, tsconfig, conventions
│   └── shared-utils/            # common helpers
├── infra/
│   ├── firebase/                # RTDB rules, Firestore indexes, setup README
│   ├── perf/                    # k6 load-test script
│   ├── scripts/                 # secrets setup
│   └── ci/                      # CI references
├── docs/
│   ├── architecture/            # overview, contracts, ADR, scalability, testing strategy
│   ├── security/                # OWASP Top-10 coverage map
│   ├── setup/                   # local development guides
│   ├── conventions/             # coding & folder conventions
│   └── initial-plan.md          # boilerplate plan
├── .github/workflows/           # CI + hosting-mirror workflows
├── firestore.rules              # Firestore: default-deny all clients
├── storage.rules                # Storage: owner/host-scoped, type+size capped
├── firebase.json / .firebaserc  # Firebase project wiring
├── .env.example                 # root environment variables
├── run.sh                       # unified local development runner
└── README.md
```

## Installation

### 1. Prerequisites

| Tool        | Version   | Purpose                         |
|-------------|-----------|---------------------------------|
| Node.js     | ≥ 22      | API + admin web runtime (CI uses 22) |
| npm         | ≥ 10      | Node package manager            |
| Flutter     | 3.44.8    | Mobile app (pinned in CI)       |
| Dart        | ≥ 3.12    | Bundled with Flutter            |
| Git         | any       | Version control                 |
| Firebase CLI| optional  | Storage/rules deploy, emulator  |

Install Flutter from the [official guide](https://docs.flutter.dev/get-started/install).
Then verify the mobile toolchain (Android SDK + emulator, or Xcode + simulator) is complete:

```bash
flutter doctor
```

`flutter run` needs a connected emulator/device — every other check must be green first.

#### macOS

Use Homebrew:

```bash
brew install node git
```

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y nodejs npm git
```

#### Windows

1. Download and install [Node.js LTS](https://nodejs.org/)
2. Download and install [Git for Windows](https://git-scm.com/download/win)
3. Install Flutter by following the [Windows install guide](https://docs.flutter.dev/get-started/install/windows)

> **Note:** `run.sh` is a Bash script. On Windows use Git Bash, WSL, or run the commands from the script manually in separate PowerShell terminals.

### 2. Clone the repository

```bash
git clone https://github.com/UOA-CS734-S2-2026/project-implementation-nimble-takahe.git
cd project-implementation-nimble-takahe
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `FIREBASE_WEB_API_KEY`, `FIREBASE_STORAGE_BUCKET` — from Firebase Console → Project settings → Service accounts (auth is Firebase ID tokens verified server-side; no JWT secret needed)

See `apps/api-server/.env.example` for the full list.

Per-app overrides can also be set by copying each app's `.env.example`:

```bash
cp apps/api-server/.env.example apps/api-server/.env
cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

### 4. Install dependencies

```bash
# API
(cd apps/api-server && npm install)

# Admin web
(cd apps/admin-web && npm install --legacy-peer-deps)

# Mobile
(cd apps/mobile && flutter pub get)
```

> **Note:** The admin web currently requires `--legacy-peer-deps` due to a peer-dependency mismatch between ESLint packages.

### 5. Set up Firebase (backend database)

The API reads/writes Firestore + Realtime Database via the Firebase Admin SDK.
Create a service account (Firebase Console → Project settings → Service accounts),
then put its fields into `apps/api-server/.env` (see `apps/api-server/.env.example`).
Storage rules live in `storage.rules` — deploy with `firebase deploy --only storage` when needed.

### 6. Run the apps

The easiest way is the provided helper script (works on macOS, Ubuntu, WSL, and Git Bash):

```bash
./run.sh
```

This starts the API and admin web in the background and streams their logs. To also launch the mobile app when an Android/iOS device or emulator is available:

```bash
./run.sh mobile
```

To stop everything:

```bash
./run.sh stop
```

Alternatively, run each app in its own terminal:

```bash
# Terminal A — API
cd apps/api-server && npm run dev
# → http://localhost:4000/api/health

# Terminal B — admin web
cd apps/admin-web && npm run dev
# → http://localhost:5173

# Terminal C — mobile (requires emulator or device)
cd apps/mobile && flutter run
```

### 7. Verify the setup

- API: `curl http://localhost:4000/api/health` should return `{"ok":true,"data":{"status":"ok","service":"api-server","database":"connected"}}`
- Admin web: open http://localhost:5173
- Mobile: launches in your emulator/device

## Demo Accounts

Demo logins (same password for all): `alex.mercer@matchup.demo`, `sarah.chen@matchup.demo`, `mike.chen@matchup.demo`, `lisa.park@matchup.demo`, `james.wilson@matchup.demo` — password `MatchUp123!`. These accounts are players/hosts for the mobile app.

### Admin account (admin web)

Log in to the admin web (`/login`) with the admin account:

- Email: `admin@matchup.com`
- Password: `MatchUp123!`

This account has full access to all moderation routes (members, activities, reports, appeals, broadcasts, analytics). The demo accounts above are players/hosts and cannot open the admin web.

## Scripts by App

| App              | Dev                | Build              | Lint / Analyze              |
|------------------|--------------------|--------------------|-----------------------------|
| `apps/api-server`| `npm run dev`      | `npm run build`    | `npx tsc --noEmit` + `npm test` |
| `apps/admin-web` | `npm run dev`      | `npm run build`    | `npm run lint`              |
| `apps/mobile`    | `flutter run`      | `flutter build`    | `flutter analyze`           |

### Mobile release builds (OWASP M7 — binary protection)

Release builds must obfuscate Dart code and split debug info (keeps stack
traces symbolicatable via the emitted `.map` files — store them per release):

```bash
cd apps/mobile
flutter build apk --obfuscate --split-debug-info=build/debug-info
flutter build ipa --obfuscate --split-debug-info=build/debug-info
```

### Useful api-server commands

```bash
cd apps/api-server
npm test               # vitest suite
npm run perf:smoke     # latency-budget smoke against a running server
npm run seed           # seed script (src/scripts/seed.ts)
npm run seed:akl100    # 100-activity Auckland re-seed
```

## Testing

Testing is a first-class concern: CI fails the build on test failures for every layer.

| Layer | Command | Coverage |
|-------|---------|----------|
| API | `cd apps/api-server && npm test` (vitest + supertest, hermetic in-memory fakes) | `npm run test -- --coverage` gate in CI |
| Admin web | `cd apps/admin-web && npm test` | `npm run test:coverage` gate + `npm run lint` in CI |
| Mobile | `cd apps/mobile && flutter test --coverage` (+ `flutter analyze`, must be clean) | 65% line-coverage gate in CI |
| Performance | `cd apps/api-server && npm run perf:smoke` (p50/p95 budgets) + k6 script `infra/perf/k6-auth-flow.js` | — |
| On-device | Android emulator (API 34+) + physical devices for GPS, camera, push; permission matrices (denied/deniedForever/services-disabled) degrade gracefully, never crash | — |

Full strategy (pyramid, hermetic fakes, widget coverage, perf budgets): [`docs/architecture/testing-strategy.md`](docs/architecture/testing-strategy.md).

## Security

Mapped control-for-control against the OWASP Top 10 (2021) in [`docs/security/owasp-top-10.md`](docs/security/owasp-top-10.md); accepted risks are called out as conscious trade-offs. Highlights:

- **Access control** — per-request Firebase ID-token verification (with revocation check); suspension enforced on every request; admin routes fail closed; Firestore default-deny for all client SDKs; RTDB writes backend-only (except self-scoped presence); Storage owner/host-scoped with type + size caps.
- **Data protection** — tokens only in Keychain/Keystore (never SharedPreferences/Hive); HTTPS enforced outside local dev (client guard + Android network security config + iOS ATS); Firebase handles passwords (backend never sees them); Bearer tokens redacted in logs.
- **Input & abuse** — zod validation (env fail-fast boot + per-route schemas), 1 MB JSON cap, per-IP rate limiting (global + burst caps), Nominatim behind a cached server-side proxy.
- **Supply chain & secrets** — locked dependencies, `npm audit` gate on the production tree, secrets-guard CI job blocks tracked `.env`/keys, Dependabot updates.

### Lab 07 security review (Sep 2026)

Reviewed every data-changing endpoint for BOLA (details: [Wiki Lab 07 page](https://github.com/UOA-CS734-S2-2026/project-implementation-nimble-takahe/wiki/Lab-07-Security-Review)):
- **Checked** — all API mutating routes derive identity from the verified Firebase ID token (never client-supplied ids); ownership/host/admin gates per route; RTDB writes backend-only; Firestore default-deny.
- **Fixed** — RTDB `dmChats` broad read let any signed-in user read any 1-on-1 thread (deterministic thread ids + direct client reads). Now party-only; attacker-tested on the RTDB emulator (outsider denied, parties allowed). Deploy via `firebase deploy --only database`.
- **Accepted gaps** — RTDB `activityChats`/`typing` reads are any-authenticated-user (needs a membership index to tighten; API layer gates correctly, writes are backend-only).

## Configuration
The project private keys is compressed in ZIP format. The each application environment file is already store based on this project structure. To implement the environment variable is <strong>to just copy the "apps" folder inside "nimble-takahe-private-keys" to the project root</strong>

Key variables (see [environment variables doc](docs/setup/environment-variables.md) and each app's `.env.example`):

| Variable | App | Purpose |
|----------|-----|---------|
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | API | Admin SDK service account |
| `FIREBASE_DATABASE_URL` / `FIREBASE_STORAGE_BUCKET` / `FIREBASE_WEB_API_KEY` | API, mobile, web | Data-plane wiring |
| `ADMIN_UIDS` | API | Bootstrap admin allowlist (primary source: Firestore `admins` collection) |
| `CORS_ORIGINS` | API | Browser allowlist; **required in production** (boot refuses without it) |
| `VITE_API_BASE_URL` (+ Firebase web keys) | Admin web | API base + sign-in config |
| `API_BASE_URL` / `APP_ENV` | Mobile | API base (HTTPS enforced unless `local`) + env label |

## Common Issues

### `flutter: command not found`

Make sure Flutter is installed and on your `PATH`. Verify with:

```bash
flutter doctor
```

### `npm install` fails with ERESOLVE on the admin web

Use `--legacy-peer-deps`:

```bash
cd apps/admin-web && npm install --legacy-peer-deps
```

### Port 4000 or 5173 already in use

Stop any running services:

```bash
./run.sh stop
```

Or override ports in `apps/api-server/.env` and `apps/admin-web/.env`.

### API health returns `DB_UNAVAILABLE`

Check that `apps/api-server/.env` has valid Firebase credentials and the
service account has Firestore/Realtime Database access.

### Kotlin Increment failure during the Gradle build (usually for Windows Machine)

If encounter a error message contains this

```bash
java.lang.Exception: Could not close incremental caches in .....
```

Turn off the Kotlin incremental in Gradle properties. Navigate to <strong>$root\apps\mobile\android\gradle.properties</strong> and Add this line
```bash
kotlin.incremental=false
```

## Documentation

- [Architecture overview](docs/architecture/overview.md) — system as built
- [Mobile API contract](docs/architecture/mobile-api-contract.md) + [Admin API contract](docs/architecture/admin-api-contract.md)
- [ADR-001: protocols](docs/architecture/adr-001-protocols.md) — REST vs GraphQL vs sockets, and why
- [Scalability](docs/architecture/scalability.md) — demand model, limits, scale-up runbook
- [Testing strategy](docs/architecture/testing-strategy.md)
- [OWASP Top-10 coverage map](docs/security/owasp-top-10.md)
- [Boilerplate plan](docs/initial-plan.md) — what this phase delivers
- [Local development guide](docs/setup/local-development.md)
- [Environment variables](docs/setup/environment-variables.md)
- [Firebase setup (RTDB rules + client config)](infra/firebase/README.md)
- [Coding standards](docs/conventions/coding-standards.md)

Team meeting minutes (held at least weekly) plus task breakdown live in the repo Wiki.

## Team — Nimble Takahe

- Aidil Muslim (`amus790`)
- Manu R (`msri874`)
- Armanda Darmara (`adar521`)
- Imam Nurhidayat (`inur448`)

COMPSCI 734 project workflow: feature branches + pull-request reviews, CI green on every push/PR, regular fine-grained commits from every member.
