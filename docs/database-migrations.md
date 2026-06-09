# Database Migrations

**Last Updated:** June 9, 2026  
**Package:** `@ai-connect/db`  
**ORM:** Drizzle 0.36 + drizzle-kit 0.30  
**Database:** PostgreSQL 16+  
**Scope:** Chat history persistence (conversations and messages); admin and quota modules remain in-memory.

---

## Overview

`@ai-connect/db` is the Postgres + Drizzle persistence layer for the ai-connect monorepo. It exports a typed Drizzle client, database schema, and CLI tools for migration management.

**Package Exports:**
- `createDbClient(options)` — Factory for creating typed Drizzle + postgres-js clients
- `db`, `sql`, `close()` — Client instance, underlying SQL connection, pool shutdown
- Schema tables and inferred row types (e.g., `conversations`, `messages`, `workspaces`)

**Supported Data:**
- **Conversations & Messages** — Full persistence via `ConversationRepository` and `MessageRepository`
- **Workspaces, Users, Providers** — Schema defined; admin CRUD still in-memory (phase scope boundary)
- **Usage Metrics, Provider Catalogs** — Schema defined; out of scope this phase

---

## Local Development Setup

### 1. Start the Postgres Container

Bring up the local database:

```bash
docker compose up -d db
```

Verify it's healthy:

```bash
docker compose ps
# Shows: db ... (healthy)
```

### 2. Copy Environment Variables

```bash
cp .env.example .env
```

Verify the `.env` file contains:

```bash
DATABASE_URL=postgres://ai_connect:ai_connect_dev@localhost:5432/ai_connect
DATABASE_POOL_MAX=10
```

If port 5432 is already in use, override via `.env`:

```bash
POSTGRES_PORT=5433  # Use non-standard port
```

### 3. Install Dependencies and Build

```bash
pnpm install
pnpm build
```

### 4. Apply Migrations

Run pending migrations:

```bash
pnpm db:migrate
```

On success:

```
[llm-db] migrations applied
```

The database is now ready for development.

---

## Daily Development Workflow

### Generate New Migrations

After editing a schema file in `llm-db/src/schema/*.ts`:

```bash
pnpm db:generate
```

This:
1. Compiles TypeScript schema to `llm-db/dist/schema/index.js`
2. Runs `drizzle-kit generate` to compare compiled schema vs. migration history
3. Emits SQL migration file in `llm-db/drizzle/` (e.g., `0002_add_column.sql`)

**Important:** `pnpm db:generate` **requires a successful TypeScript build first**. The script runs `tsc -p tsconfig.json && drizzle-kit generate` automatically. Drizzle-kit cannot resolve `.ts` imports directly; it must read the compiled `.js` files.

### Review Generated SQL

Always review generated migrations before applying:

```bash
# Read the generated SQL
cat llm-db/drizzle/000X_your_change.sql
```

Check for:
- Correct table/column names (typos from schema edits)
- Correct data types
- Drop statements only if intentional (destructive changes require manual review)

### Apply Migrations

Run pending migrations:

```bash
pnpm db:migrate
```

This applies all `.sql` files in `llm-db/drizzle/` in numeric order.

---

## Reversibility Policy

### Forward-Only by Default

Drizzle-kit generates **forward migrations only** — it does NOT emit down (reverse) SQL. This is intentional: reversals are rare in production and error-prone.

**For destructive changes (dropping columns, tables):**

1. **Generate the forward SQL** (drop or alter statement)
2. **Manually write the reverse SQL** — save it in a separate file or document if rollback is critical
3. **Apply the forward migration** to production
4. **Keep the reverse SQL documented** in case manual rollback is needed

**Example:**

Forward migration (`0003_drop_legacy_column.sql`):

```sql
ALTER TABLE conversations DROP COLUMN legacy_field;
```

If rollback is required, manually re-run:

```sql
ALTER TABLE conversations ADD COLUMN legacy_field TEXT;
```

### No Automatic Rollbacks

There is no automatic "down" SQL executed by the migration CLI. Once a migration is applied:
- Forward migrations are recorded in the `_drizzle_migrations` table
- Reversals must be applied as new forward migrations or manual SQL scripts

---

## Resetting the Local Database

To start fresh (wipes all data):

```bash
docker compose down -v
docker compose up -d db
pnpm db:migrate
```

This:
1. Stops and removes the Postgres container (`docker compose down`)
2. Deletes the named volume (`-v` flag)
3. Recreates and starts a fresh database instance
4. Re-applies all migrations from scratch

---

## CI/CD Migration Behavior

### Build and Check Phase

In `.github/workflows/ci.yml`, CI performs a **drift check** before touching the database:

```bash
pnpm -r build                            # Compile workspace (including schema)
pnpm exec drizzle-kit check              # Fail if migration history is corrupted
```

If the check fails, the workflow stops immediately — CI prevents applying inconsistent migrations.

### Migration and Test Phase

After drift check passes:

```bash
pnpm db:migrate                          # Apply pending migrations to test database
pnpm -r test                             # Run all tests with PERSISTENCE=drizzle
```

**Env variables set in CI:**
- `DATABASE_URL=postgres://ai_connect:ai_connect_ci@localhost:5432/ai_connect`
- `PERSISTENCE=drizzle` — Enables Drizzle-backed repos in chat v2

**Services:**
- `postgres:16-alpine` container spins up with health checks
- Waits for health check to pass before running migrations

---

## Production Migration Pattern

### Pre-Boot Migration

In production, run migrations **before** the application boots:

```bash
# Build workspace (includes llm-db)
pnpm -r build

# Apply migrations from compiled output
node llm-db/dist/cli/migrate.js
```

(Or via `pnpm db:migrate` if pnpm is available in the container.)

**Why separate from boot:**
- Ensures all tables/columns exist before app code runs
- Prevents schema-mismatch errors during startup
- Allows safe rollback of app version if migration fails
- Clear separation of concerns in deployment pipeline

### Boot the Application

Once migrations succeed, start the application server:

```bash
node llm-http/dist/index.js
```

The app will:
1. Instantiate `createDbClient()` with the `DATABASE_URL`
2. Connect to the post-migration database
3. Initialize conversation and message repositories with Drizzle backing
4. Begin accepting requests

### Failure Handling

If migration fails in production:
1. Logs will indicate which migration failed
2. Manual SQL rollback (reverse migration) must be applied if rollback is needed
3. Investigate the root cause (schema conflict, data integrity, corrupt migration file)
4. Once fixed, re-run migrations and retry app startup

---

## Migration History and State

### Tracking Applied Migrations

Drizzle tracks applied migrations in the `_drizzle_migrations` table:

```bash
# View migration history (requires psql access)
psql DATABASE_URL -c "SELECT * FROM _drizzle_migrations ORDER BY hash;"
```

Each row records:
- `hash`: SHA1 hash of migration SQL
- `created_at`: When migration was applied

### Migration Files

Migration files are stored in `llm-db/drizzle/`:

```
llm-db/drizzle/
├── 0000_phase02_init.sql          # Phase 2: Initial 10-table schema
├── 0001_add_user_system_role.sql  # Phase 2: System role enum on users
└── 000X_your_change.sql           # (Generated on demand)
```

Files are applied in **numeric order only** — do not rename or reorder files.

---

## Schema Overview

**Current tables (as of 0001):**

| Table | Columns | Purpose | Notes |
|-------|---------|---------|-------|
| `workspaces` | id, slug, name, timestamps | Workspace isolation | Soft-deletes via `deleted_at` |
| `users` | id, username, passwordHash, role, timestamps | User accounts | System-level `role` (admin\|member) |
| `user_workspaces` | user_id, workspace_id, timestamps | User membership | Composite PK |
| `user_role_workspaces` | user_id, workspace_id, role, timestamps | Workspace-scoped roles | Separate from system role |
| `conversations` | id, workspace_id, user_id, title, timestamps | Chat sessions | Per workspace + user |
| `messages` | id, conversation_id, role, content, timestamps | Chat messages | Role: user\|assistant\|system |
| `provider_catalogs` | id, name, host, models (JSONB), timestamps | LLM provider registry | Models stored as JSON array |
| `providers` | id, catalog_id, alias, baseUrl, apiKeyRef, enabled, timestamps | Provider instances | Workspace-agnostic config |
| `workspace_providers` | workspace_id, provider_id, aliasOverride, enabled, timestamps | Workspace provider selection | Per-workspace provider overrides |
| `usage_metrics` | id, workspace_id, user_id, provider_id, conversation_id, ... | Token usage tracking | For quota enforcement |

---

## Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DATABASE_URL` | string | Yes | — | Postgres connection string |
| `DATABASE_POOL_MAX` | number | No | 10 | Max connection pool size |
| `POSTGRES_PORT` | number | No | 5432 | Local Postgres port override (docker-compose only) |
| `PERSISTENCE` | string | No | in-memory | Set to `drizzle` to enable DB backing in llm-http |

---

## Common Tasks

### Add a New Column to a Table

1. Edit the schema file (e.g., `llm-db/src/schema/conversations.ts`)
2. Run `pnpm db:generate`
3. Review the generated SQL in `llm-db/drizzle/`
4. Run `pnpm db:migrate`

### Rename a Column

Drizzle-kit does NOT detect renames automatically (they appear as drop + add). For a true rename:

1. Generate the forward migration (it will emit drop + add)
2. Edit the migration file to use `ALTER TABLE ... RENAME COLUMN`
3. Run `pnpm db:migrate`

### View Database Schema

Query the schema in Postgres:

```bash
psql $DATABASE_URL -c "\dt"  # List tables
psql $DATABASE_URL -c "\d conversations"  # Describe table
```

Or use Drizzle Studio (visual browser):

```bash
pnpm db:studio
```

Opens a web interface for exploring tables and data.

### Debug Migration Errors

Enable verbose output:

```bash
DATABASE_URL=postgres://... drizzle-kit generate --verbose
```

Check migration file syntax:

```bash
cat llm-db/drizzle/000X_your_change.sql
```

Verify database state:

```bash
psql $DATABASE_URL -c "SELECT * FROM _drizzle_migrations;"
```

---

## See Also

- **[System Architecture](./system-architecture.md)** — Database layer in context
- **[Codebase Summary](./codebase-summary.md)** — `@ai-connect/db` package details
- **[Code Standards](./code-standards.md)** — Schema design conventions
- **Drizzle Docs:** [https://orm.drizzle.team](https://orm.drizzle.team)
- **PostgreSQL Docs:** [https://www.postgresql.org/docs/16/](https://www.postgresql.org/docs/16/)
