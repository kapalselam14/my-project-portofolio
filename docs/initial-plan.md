# MatchUp — Boilerplate Setup Plan

## 1. Purpose

This document defines the **boilerplate setup plan** for MatchUp. The purpose of this phase is to establish a clean, scalable, and developer-friendly foundation for the project before implementing business features.

This phase is focused on **project initialization only**. It is not intended to deliver product functionality such as matchmaking logic, reporting workflows, moderation workflows, chat, analytics, or notifications. Instead, it prepares the repository, applications, shared packages, development standards, and infrastructure baseline so feature development can begin on a stable foundation.

---

## 2. Scope

The scope of this boilerplate phase is limited to the core technical foundation of the platform.

Included in scope:

- single-repo project structure
- mobile app bootstrap
- admin web bootstrap
- backend API bootstrap
- Firebase (Firestore + RTDB) baseline
- Tailwind CSS setup for the React admin web
- shared packages setup
- environment configuration
- linting and formatting
- CI baseline
- documentation for local development and onboarding

Not included in scope:

- production-ready authentication logic
- activity discovery logic
- swipe interaction logic
- reporting flow
- moderation flow
- push notification implementation
- chat implementation
- analytics implementation
- advanced role and permission flows

---

## 3. High-Level Technical Direction

The initial boilerplate will follow the stack already aligned with the proposal:

- **Mobile app:** Flutter
- **Admin web:** React.js + Tailwind CSS
- **Backend API:** Node.js + Express
- **Database:** Firebase (Firestore + RTDB + Storage)
- **Repository model:** Single repository

The repo should be structured so that all platform applications live in one place while still being clearly separated. This will make onboarding easier, reduce configuration duplication, and allow the team to maintain shared documentation and conventions centrally.

---

## 4. Repository Structure

The project will use a **single repository** with a structure that separates applications, shared packages, infrastructure files, and documentation.

matchup/
├── apps/
│   ├── mobile/                  # Flutter mobile app
│   ├── admin-web/               # React + Tailwind CSS admin dashboard
│   └── api/                     # Node.js + Express backend
├── packages/
│   ├── shared-types/            # shared enums, DTO placeholders, constants
│   ├── shared-config/           # eslint, prettier, tsconfig, conventions
│   └── shared-utils/            # common helpers
├── infra/
│   ├── database/                # migrations, seeds, schema notes
│   └── ci/                      # CI/CD references or helper scripts
├── docs/
│   ├── architecture/
│   ├── setup/
│   └── conventions/
├── .github/
│   └── workflows/
├── .env.example
├── README.md
└── plan.md

This structure keeps each application isolated while allowing the team to maintain a unified development workflow.

---

## 5. Boilerplate Objectives

At the end of this phase, the repository should already provide the following baseline:

- the single repo is created and organized
- the mobile app can run locally
- the admin web can run locally with Tailwind CSS
- the backend API can run locally
- the backend can connect to Firebase
- shared configs and packages are initialized
- linting and formatting rules are available
- CI runs basic validation checks
- setup documentation is ready for developers

This phase should produce a repository that is ready for implementation work, even if most business logic is still placeholder-only.

---

## 6. Admin Web Boilerplate Plan

The admin dashboard will use **React.js + Tailwind CSS**. This app is expected to grow into a data-heavy internal dashboard, so the boilerplate should prioritize clarity, reusable layout patterns, and consistent styling.

### 6.1 Goals

The admin web boilerplate should include:

- React application bootstrap
- Tailwind CSS installation and configuration
- routing setup
- base layout shell
- placeholder pages
- environment variable handling
- API client skeleton
- reusable UI primitives
- styling conventions for dashboard pages

### 6.2 Suggested Structure

apps/admin-web/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── feature/
│   ├── pages/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── members/
│   │   ├── activities/
│   │   ├── reports/
│   │   └── broadcasts/
│   ├── services/
│   ├── hooks/
│   ├── utils/
│   ├── styles/
│   └── main.jsx
├── public/
├── tailwind.config.js
├── postcss.config.js
└── package.json

### 6.3 Tailwind Baseline

Tailwind should be configured from the beginning with a minimal styling standard. The initial goal is not to build a full design system, but to establish enough consistency for the dashboard to grow without becoming visually fragmented.

The boilerplate should already define:

- base layout spacing
- typography scale
- color palette for neutral and semantic states
- card and panel styling
- table styling baseline
- form styling baseline
- badge styling baseline
- sidebar and topbar layout styles

### 6.4 Initial UI Primitives

The first reusable UI layer should include simple primitives such as:

- button
- input
- textarea
- select
- badge
- card
- table wrapper
- modal shell
- page header
- sidebar item

These should stay lightweight and easy to reuse across dashboard pages.

### 6.5 Minimum Working State

By the end of the boilerplate phase, the admin web should already have:

- a running local app
- a dashboard shell
- placeholder routes
- a sidebar and top navigation
- a shared page container
- a configured Tailwind environment
- a basic API service layer placeholder

No business logic is required yet.

---

## 7. Mobile App Boilerplate Plan

The mobile application will use **Flutter**. The goal of the mobile boilerplate is to prepare a feature-friendly structure that can support later modules such as auth, discovery, activities, notifications, and reporting.

### 7.1 Goals

The mobile boilerplate should include:

- Flutter app bootstrap
- environment configuration
- base routing or navigation structure
- feature-based folder organization
- API service layer skeleton
- storage abstraction skeleton
- placeholder screens
- base theme setup

### 7.2 Suggested Structure

apps/mobile/
├── lib/
│   ├── app/
│   ├── core/
│   │   ├── config/
│   │   ├── constants/
│   │   ├── network/
│   │   ├── storage/
│   │   ├── services/
│   │   └── utils/
│   ├── features/
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── discovery/
│   │   ├── activities/
│   │   └── notifications/
│   └── main.dart
├── test/
└── pubspec.yaml

### 7.3 Minimum Working State

By the end of the boilerplate phase, the mobile app should already provide:

- a working app entrypoint
- a navigation shell
- placeholder screens
- config loading structure
- a network service placeholder
- a local storage abstraction placeholder
- a base application theme

No real auth, activity, or matching logic is needed yet.

---

## 8. API Boilerplate Plan

The backend will use **Node.js + Express**. The main goal of the API boilerplate is to create a clean modular structure and establish a stable baseline for configuration, routing, error handling, and database connectivity.

### 8.1 Goals

The API boilerplate should include:

- Express bootstrap
- modular folder structure
- environment configuration
- database connection setup
- middleware structure
- centralized error handling
- logger setup
- health endpoint
- placeholder route modules

### 8.2 Suggested Structure

apps/api/
├── src/
│   ├── app/
│   ├── config/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── activities/
│   │   ├── reports/
│   │   └── admin/
│   ├── middleware/
│   ├── database/
│   ├── common/
│   └── server.ts
├── tests/
└── package.json

### 8.3 Minimum Working State

The API should already have:

- a running local server
- a `/health` endpoint
- route registration structure
- environment variable loading
- centralized error middleware
- placeholder auth middleware
- logger initialization
- database connection test

No business module needs to be implemented beyond placeholders.

---

## 9. Database Boilerplate Plan

The database phase in the boilerplate should remain minimal and focus only on readiness for future schema implementation.

### 9.1 Goals

The database setup should include:

- Firebase connection
- Admin SDK wiring
- seed structure
- local development DB instructions
- baseline database config

### 9.2 Minimum Working State

At this stage, the project only needs:

- a working database connection
- a migration command
- a seed command structure
- an initial migration baseline
- a simple starter schema or test table if needed

The full production schema should be designed in the next phase, not during boilerplate setup.

---

## 10. Shared Packages Plan

Because this is a single-repo project, shared packages should be introduced early but remain intentionally small.

### 10.1 `shared-types`

This package can contain:

- role enum placeholders
- status enum placeholders
- common response type placeholders
- shared domain constants where useful

### 10.2 `shared-config`

This package can contain:

- prettier config
- eslint config
- base TypeScript config if applicable
- naming and foldering conventions

### 10.3 `shared-utils`

This package can contain:

- string helpers
- date helpers
- small reusable utilities

The team should avoid building complex abstractions too early. These packages should support consistency, not create unnecessary architectural weight.

---

## 11. Environment Configuration Plan

The project should define environment handling from the start so each app can be configured consistently.

### 11.1 Environments

The repo assumes three environments:

- local
- staging
- production

### 11.2 Minimum Variables

#### API
- `PORT`
- Firebase Admin SDK credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`)
- `CORS_ORIGINS`

#### Admin Web
- `VITE_API_BASE_URL` or equivalent client variable

#### Mobile
- API base URL variable
- environment label if needed

### 11.3 Output

The boilerplate phase should produce:

- a root `.env.example`
- app-specific variable notes where necessary
- clear environment documentation in the README or setup docs

---

## 12. Linting and Formatting Plan

A healthy boilerplate should include basic code quality controls from the beginning.

### 12.1 Required Tooling

The initial setup should include:

- Prettier
- ESLint for admin web and API
- Flutter analyze support
- consistent scripts for dev, build, lint, and test
- import and naming conventions

### 12.2 Objective

The goal is to ensure that all new code follows a shared baseline and that the repo does not drift into inconsistent patterns during early development.

---

## 13. CI Baseline Plan

The CI setup for this phase should stay small and practical.

### 13.1 Minimum Checks

Each pull request or push to the main integration branch should run:

- dependency installation
- admin web lint
- API lint
- admin web build
- API build or type check
- Flutter analyze
- basic tests where available

### 13.2 Objective

The purpose of CI at this stage is not full release automation. It is only to protect the boilerplate foundation and prevent basic breakage.

---

## 14. Documentation Plan

The boilerplate phase should also leave behind enough documentation so new developers can start quickly.

### 14.1 Minimum Documentation

The repository should include:

- root README
- local setup guide
- repository structure explanation
- environment variable guide
- coding convention notes
- quick start commands for each app

### 14.2 Objective

The documentation should make it possible for a new developer to clone the repo, install dependencies, configure env files, and run all applications locally without additional verbal guidance.

---

## 15. Execution Order

The boilerplate phase should be delivered in a small number of practical steps.

### Phase A — Repository Foundation

Deliverables:

- create single-repo structure
- create `apps`, `packages`, `infra`, and `docs`
- add root README
- add root `.env.example`

### Phase B — Application Scaffolding

Deliverables:

- bootstrap Flutter mobile app
- bootstrap React admin web
- bootstrap Express API
- initialize shared packages

### Phase C — Developer Experience Setup

Deliverables:

- install Tailwind in admin web
- configure linting and formatting
- add root scripts if needed
- define initial folder conventions

### Phase D — Backend and Database Baseline

Deliverables:

- connect API to Firebase
- add migration tooling
- add seed structure
- add health endpoint
- document DB setup

### Phase E — CI and Documentation

Deliverables:

- add CI workflow
- finalize setup documentation
- verify local setup flow end-to-end

---

## 16. Definition of Done

The boilerplate phase is considered complete when all of the following are true:

- the single repo structure is in place
- the mobile app runs locally
- the admin web runs locally with Tailwind CSS
- the API runs locally
- the API connects to Firebase
- Admin SDK is initialized
- shared config exists
- linting and formatting work
- CI baseline runs successfully
- setup documentation is complete enough for onboarding

Once these conditions are met, the project can move into the next phase: implementing actual MVP features.

---

## 17. Recommendation

This boilerplate phase should remain intentionally narrow. It should focus on **foundation, consistency, and readiness**, not feature delivery.

After this phase is completed, the next planning document should cover the **MVP implementation plan**, starting with:

- authentication
- user profile and preferences
- activities
- join and leave flows
- reporting basics
- moderation basics
