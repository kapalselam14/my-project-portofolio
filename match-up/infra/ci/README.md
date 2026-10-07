# MatchUp — CI Reference

CI workflows live at `.github/workflows/`. The current boilerplate workflow runs basic validation:

- `admin-web`: `npm ci` → `lint` → `build`
- `api`: `npm ci` → `lint` → `test` → `build`
- `mobile`: `flutter pub get` → `analyze`

Each job is isolated; failures block merging to `main`.

## Adding new jobs

When new apps are added, extend `ci.yml` with a matching job that mirrors the local commands developers already use. Keep CI commands identical to local commands so debugging failures is straightforward.