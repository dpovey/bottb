# Claude Code Guidelines

**See `AGENTS.md` for full development guidelines.**

This project primarily uses Cursor's native configuration:

- **Rules**: `.cursor/rules/` - Declarative standards (always-on and file-scoped)
- **Subagents**: `.cursor/agents/` - Specialized agents for focused tasks
- **Skills**: `.cursor/skills/` - Step-by-step procedural workflows

Claude Code agents in `.claude/agents/` mirror the Cursor subagents for compatibility.

## Quick Reference

### Pre-commit Commands

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
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
