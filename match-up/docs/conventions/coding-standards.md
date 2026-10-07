# Coding Standards

The goal of this document is consistency, not perfection. When in doubt, match the patterns already in the file you are editing.

## Languages and tooling

- **TypeScript** for the API and admin web (strict mode, ES2022 target).
- **Dart** for the Flutter app (with `flutter_lints`).
- **SQL** for migrations (`lowercase_snake_case` for table and column names).

## Naming conventions

| What                | Convention              | Example                  |
| ------------------- | ----------------------- | ------------------------ |
| TypeScript types    | `PascalCase`            | `AuthUser`, `ApiResponse`|
| TypeScript values   | `camelCase`             | `authUser`, `apiClient`  |
| React components    | `PascalCase`            | `DashboardPage`, `Button`|
| Hooks               | `useCamelCase`          | `useAuth`, `useApi`      |
| Files (TS/React)    | match the export        | `auth.ts`, `Dashboard.tsx` |
| Dart classes        | `PascalCase`            | `LocalStorage`, `Env`    |
| Dart files          | `snake_case`            | `local_storage.dart`     |
| Database tables     | `snake_case`, plural    | `users`, `activities`    |
| Database columns    | `snake_case`            | `created_at`, `user_id`  |
| SQL files           | `NNN_description.sql`   | `001_users.sql`          |

## Folder structure

Apps follow the conventions listed in [`docs/initial-plan.md`](../initial-plan.md):

- **API** — feature modules under `src/modules/<feature>/{routes,controller,service,repository}.ts`
- **Admin web** — pages under `src/pages/<page>/`, layout under `src/components/layout/`, reusable primitives under `src/components/ui/`
- **Mobile** — features under `lib/features/<feature>/{presentation,application,data,domain}/`

## Imports

- Use **relative paths** within an app (`./`, `../`).
- Cross-app imports (admin web ↔ API types) go through `packages/shared-types` and `packages/shared-utils`, accessed via relative path from each app for now.
- Avoid wildcard imports (`import * as Foo from ...`) unless working with a namespace module.

## Formatting

Run `npm run format` (or `dart format .`) before committing. The shared Prettier config lives in `packages/shared-config/prettier.json`.

## Linting

Run `npm run lint` (or `flutter analyze`) before committing. CI runs the same checks — a PR with lint failures will be blocked.

## Git workflow

- Branch from `main`: `git checkout -b feature/<short-name>`
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat: add activity discovery endpoint`
  - `fix: prevent duplicate swipe records`
  - `chore: bump deps`
  - `docs: update setup guide`
  - `refactor: extract user repository`
- PRs require at least one approving review (branch protection is enabled on `main`).
- Keep PRs small — one feature, one fix, or one refactor per PR.

## Testing

The boilerplate phase ships with placeholder test files. Real tests will be added alongside the features they exercise. The MVP plan should add:

- API: `supertest` + `vitest` for route handlers
- Admin web: `vitest` + `@testing-library/react` for components
- Mobile: `flutter_test` widget and unit tests

Tests live next to the code they cover (`*.test.ts` / `*.test.tsx` / `*_test.dart`).