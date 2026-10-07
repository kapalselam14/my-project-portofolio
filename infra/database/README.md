# MatchUp — Local Database Setup

The boilerplate phase ships **only the database connection code and migration runner** in `apps/api`. Each developer is responsible for running a local PostgreSQL instance for development.

> Production schema design is **out of scope** for the boilerplate phase. Real tables will be added in the MVP phase.

## Option A — Homebrew PostgreSQL 16 (recommended on macOS)

```bash
# Install
brew install postgresql@16

# Start the service (auto-restarts on boot)
brew services start postgresql@16

# One-off start without brew services:
#   pg_ctl -D /usr/local/var/postgresql@16 start

# Create the dev database + user
createuser -s matchup
createdb -O matchup matchup

# Verify
psql postgres://matchup:matchup@localhost:5432/matchup -c '\dt'
```

Add the connection string to `apps/api/.env`:

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/matchup
```

Then apply the baseline migration:

```bash
cd apps/api
npm run migrate
```

## Option B — Docker

If you prefer containers, a minimal `docker-compose.yml` for local dev:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: matchup
      POSTGRES_PASSWORD: matchup
      POSTGRES_DB: matchup
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

```bash
docker compose up -d
```

## Migration workflow

The API uses **Prisma Migrate**. Migrations live in `apps/api/prisma/migrations`:

```
apps/api/prisma/migrations/
  20240803000000_init/   # baseline — generated from existing schema
    migration.sql
  migration_lock.toml
```

Run pending migrations:

```bash
cd apps/api
npm run migrate
```

To create a new migration after changing `prisma/schema.prisma`:

```bash
cd apps/api
npx prisma migrate dev --name <description>
```

Never edit a migration that has already been applied to staging or production — add a new one instead.

## Seed data

`apps/api/seeds/seed.sql` is a placeholder. Real seed scripts (sample members, activities, etc.) will be added in the MVP phase.

To apply seeds manually:

```bash
psql $DATABASE_URL -f apps/api/seeds/seed.sql
```

## Verifying the connection from the API

Start the API and hit `/health`:

```bash
cd apps/api
npm run dev
# in another terminal
curl http://localhost:4000/health
# → {"ok":true,"data":{"status":"ok","service":"matchup-api"}}
```

The `/health` endpoint intentionally does not touch the database — it returns 200 even if the DB is offline. A future `/health/db` endpoint will perform a live ping; for now, run `npm run migrate` to verify the full connection round-trip.