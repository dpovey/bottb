# Claude Code Guidelines

**See `AGENTS.md` for full development guidelines** including documentation references, workflow, and coding standards.

## Quick Reference

### Documentation to Consult

| Phase              | Docs                             |
| ------------------ | -------------------------------- |
| Designing features | `DESIGN.md`, `doc/requirements/` |
| Writing code       | `doc/arch/`, `doc/practices/`    |
| Before commit      | All of the above                 |

### Pre-commit Commands

```bash
pnpm format:check     # Prettier
pnpm typecheck        # TypeScript
pnpm lint             # ESLint
pnpm test             # Tests
```

All must pass before committing.

### Key Directories

- `src/components/ui/` - Shared UI components
- `src/app/` - Next.js pages and API routes
- `src/lib/` - Utilities and database functions
- `doc/` - Architecture, practices, requirements, testing docs

### Design System

- Browse `/design-system` in the running app
- Run `pnpm storybook` for component isolation
- See `DESIGN.md` for tokens and design principles
