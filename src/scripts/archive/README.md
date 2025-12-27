# Archived Scripts

This directory contains completed one-time migration scripts and seed data scripts that are kept for reference but are no longer actively used.

## Migration Scripts

These scripts performed database schema changes that have already been applied:

- `migrate-add-*.ts` - Various column/table additions
- `migrate-create-companies-table.ts` - Companies table creation
- `migrate-finalized-events.ts` - Event finalization logic
- `migrate-rename-event.ts` - Event renaming utility
- `migrate-uuid-to-slugs.ts` - UUID to slug migration

## Seed Scripts

These scripts populated initial data:

- `seed-*.ts` - Initial data seeding for various entities

## Historical Cleanup

- `cleanup-2022-events.ts` - Cleanup of 2022 event data

---

**Note:** These scripts should not be run again on production as the migrations have already been applied. They are preserved for:

1. Reference on how migrations were performed
2. Potential use in dev/test environments
3. Historical documentation
