# Agent Guidelines

## Project Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components (ui/, icons/, layouts/, photos/, scoring/)
├── lib/           # Utilities, database (db.ts), hooks
└── scripts/       # CLI tools for event/user management
```

Key files:

- `src/lib/db.ts` - Database types and queries
- `src/lib/schema.sql` - Full database schema (for test DBs)
- `src/lib/scoring.ts` - Scoring version configs
- `src/components/ui/` - Shared UI primitives
- `next.config.ts` - Next.js configuration

## Before Starting Any Work

**STOP and do this BEFORE making any code edits:**

1. **Check current branch**: `git branch --show-current`
2. **If NOT on main**: Ask the user what to do (continue in existing worktree, or navigate to main repo first)
3. **If on main**: Create a worktree from origin/main BEFORE editing files. See [doc/agent/workflow.md](doc/agent/workflow.md) for full setup instructions.
4. **Exception**: Trivial one-line fixes may go directly to main - ask user first

Reading code to understand the task is fine. But NO edits until you're on a feature branch.

> **Why worktrees**: Changes are isolated, reviewable in PR, and easy to discard. Only ask for clarification when the task is ambiguous, not for approval to proceed.

## Database Schema Changes

When modifying the database schema, **both files must be updated**:

1. Create a migration: `pnpm migrate:create add-foo-column`
2. Update `src/lib/schema.sql` to match
3. Update types in `src/lib/db-types.ts` if needed

See `doc/arch/data-layer.md` for full migration workflow.

## Documentation

Before making changes, consult the relevant documentation:

| Phase                  | Docs to Reference                |
| ---------------------- | -------------------------------- |
| **Designing features** | `DESIGN.md`, `doc/requirements/` |
| **Writing code**       | `doc/arch/`, `doc/practices/`    |
| **Before commit**      | All of the above                 |

Key documentation:

- `DESIGN.md` - Design system, tokens, component specs
- `doc/arch/` - Architecture decisions by module
- `doc/practices/` - Coding standards and patterns
- `doc/requirements/` - Feature requirements with screenshots
- `doc/testing/` - Testing patterns and strategies

## Background Agents vs. Worktrees

Cursor supports **Background Agents** — autonomous AI agents that work independently.

**Good candidates for background agents:**

- Well-defined, self-contained tasks with clear completion criteria
- Mechanical refactors (rename across files, update imports, fix lint errors)
- Adding tests for existing code
- Documentation updates

**Keep as interactive (worktree) workflow:**

- Complex features requiring design decisions
- Debugging sessions requiring back-and-forth
- Anything touching database migrations or sensitive config

## Feature Branch Workflow

**Use git worktrees for all new features, bugfixes, and plans.**

See [doc/agent/workflow.md](doc/agent/workflow.md) for detailed instructions on:

- Starting new work (worktree setup)
- Creating and submitting PRs
- Waiting for CI and fixing failures
- Merging and cleanup

## Development Server

**Always use `pnpm dev:restart`** to start the dev server. This kills any existing server and clears the `.next` cache.

- **Main repo**: Port 3030 (default)
- **Worktrees**: Unique ports (3031, 3032...) set in `.env.local`

## Pre-commit Checklist

Before committing, you MUST complete the ASSESS checklist and run all checks.

See [doc/agent/checklist.md](doc/agent/checklist.md) for the full checklist including:

- ASSESS output format (mandatory before any commands)
- Required commands (`pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`)
- File-scoped commands for faster validation

## Commit Message Format

- Use conventional commits: `<type>: <description>`
- Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build
- Keep descriptions concise
- Do not use scopes

## Testing

See `doc/testing/` for full testing documentation.

Key principles:

- Use React Testing Library for components
- Prefer ARIA queries (getByRole, getByLabelText) over data-testid
- Mock external dependencies with MSW
- Test behavior, not implementation details

## Code Style

See `doc/practices/` for full coding standards.

Key principles:

- TypeScript for all files, strict typing
- Never use `any` to fix type errors
- Prefix unused variables with underscore (`_error`)
- Follow existing codebase patterns
- Use shared components from `src/components/ui/`
