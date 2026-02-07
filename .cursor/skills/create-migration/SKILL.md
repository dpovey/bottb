---
name: create-migration
description: Create a database migration with schema and type updates. Use when modifying the database schema, adding tables, columns, or indexes.
---

# Create Database Migration

Step-by-step process for making database schema changes.

## When to Use

- Adding, removing, or modifying database tables or columns
- Adding indexes or constraints
- Any change to the database schema

## Instructions

### 1. Create the Migration File

```bash
pnpm migrate:create {description}
```

Example: `pnpm migrate:create add-foo-column`

This creates a timestamped file in `migrations/`.

### 2. Edit the Migration

Open `migrations/TIMESTAMP_{description}.js` and add your SQL:

```javascript
exports.up = async (db) => {
  await db.query(`
    ALTER TABLE your_table
    ADD COLUMN new_column TEXT
  `)
}

exports.down = async (db) => {
  await db.query(`
    ALTER TABLE your_table
    DROP COLUMN new_column
  `)
}
```

### 3. Update Schema File

Edit `src/lib/schema.sql` to match the new schema state. This file is used for creating fresh test databases and must always reflect the current schema.

### 4. Update TypeScript Types

If the change affects types, update `src/lib/db-types.ts` to match.

### 5. Update Query Functions

If needed, update functions in `src/lib/db.ts` to use the new schema.

### 6. Run the Migration

```bash
pnpm migrate
```

### 7. Verify

- Schema matches between migration and `schema.sql`
- Types in `db-types.ts` match the schema
- All existing tests still pass: `pnpm test`

## Key Files

| File                  | Purpose                          |
| --------------------- | -------------------------------- |
| `migrations/*.js`     | Production migration files       |
| `src/lib/schema.sql`  | Full schema for fresh test DBs   |
| `src/lib/db-types.ts` | TypeScript types for DB entities |
| `src/lib/db.ts`       | Query functions                  |

## Reference

See `doc/arch/data-layer.md` for the full data layer architecture.
