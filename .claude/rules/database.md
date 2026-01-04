---
paths: src/lib/db*.ts, src/lib/schema.sql, migrations/**/*.js
---

# Database Conventions

See `doc/arch/data-layer.md` for full guidelines.

## Schema Changes

When modifying the database schema, **both files must be updated**:

1. Create a migration: `pnpm migrate:create add-foo-column`
2. Edit `migrations/TIMESTAMP_add-foo-column.js` with your SQL
3. Update `src/lib/schema.sql` to match (used for test DBs)
4. Update types in `src/lib/db-types.ts` if needed
5. Run migration: `pnpm migrate`

## Query Functions

- All database functions live in `src/lib/db.ts`
- Use parameterized queries (never string interpolation)
- Return typed results using interfaces from `src/lib/db-types.ts`
- Handle null/undefined gracefully

## Key Files

- `src/lib/db.ts` - Query functions
- `src/lib/db-types.ts` - TypeScript types for DB entities
- `src/lib/schema.sql` - Full schema for fresh test DBs
- `migrations/` - Production migration files

