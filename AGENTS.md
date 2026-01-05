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
3. **If on main**: Create a worktree in `.worktrees/` BEFORE editing files (see below)
4. **Exception**: Trivial one-line fixes may go directly to main - ask user first

Reading code to understand the task is fine. But NO edits until you're on a feature branch.

### Creating a Worktree

**Always create worktrees inside `.worktrees/` in the main repo:**

```bash
# From the main repo directory
cd /Users/deapovey/src/bottb

# Create worktree with feature branch
git fetch origin main
git worktree add .worktrees/{name} -b {type}/{name} origin/main

# Example: fix/touch-targets branch in .worktrees/touch-targets
git worktree add .worktrees/touch-targets -b fix/touch-targets origin/main

# Move to worktree and set up
cd .worktrees/{name}
pnpm install
cp /Users/deapovey/src/bottb/.env.local .
echo "PORT=3031" >> .env.local  # Use unique port (3031, 3032, etc.)
```

**Branch naming**: `{type}/{description}` where type is feat, fix, chore, refactor, etc.

**Directory naming**: `.worktrees/{short-description}` (e.g., `.worktrees/touch-targets`)

See [doc/agent/workflow.md](doc/agent/workflow.md) for full setup instructions including port assignment.

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

> **Stop and assess before running any commands.**

### Assess (Mandatory)

Read relevant docs and confirm compliance. **Output your findings before proceeding:**

1. **Practices** (`doc/practices/`) - Do we follow them? List any exceptions and justify.
2. **Architecture** (`doc/arch/`) - Consistent with patterns? If adding new patterns, update the docs.
3. **Requirements** (`doc/requirements/`) - Any deviations from specs?
4. **Scope** - Did you make any changes unrelated to this task?
5. **Impact** - Are there other parts of the codebase potentially affected by this change?

**Output format (copy and complete before running checks):**

```
## Assess

### Practices ✅/❌
[Files read, compliance status, any exceptions]

### Architecture ✅/❌
[Files read, consistency status, any new patterns to document]

### Requirements ✅/❌
[Specs checked, any deviations]

### Scope ✅/❌
[Unrelated changes: none / list them]

### Impact ✅/❌
[Other affected areas: none / list them]
```

If docs need updating, do it now before running checks.

### Run Checks

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
```

All must pass with exit code 0. See [doc/agent/checklist.md](doc/agent/checklist.md) for file-scoped commands and additional details.

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

## When Things Go Wrong

- **Merge conflict**: Stop and ask user - don't attempt auto-resolution
- **CI failure**: Read full error output, fix locally, push again
- **Database schema drift**: Run `pnpm migrate:latest`, compare with `schema.sql`
- **Port conflict**: `lsof -i :3030` to find process, then kill or use different port
- **Tests failing on unchanged code**: Ask user before proceeding

## Context Management

For large tasks:

- Read only files relevant to the current task
- Prefer `grep` over reading entire files when searching
- For files >500 lines, request specific line ranges
- Summarize findings before proceeding with edits

## Automation

- **On push**: CI runs `format:check`, `typecheck`, `lint`, `test`
- **On PR create**: Vercel preview deployment
- **On merge to main**: Production deployment

## Specialized Agents

Specialized agent profiles are available in `.claude/agents/` for focused tasks. These work natively with Claude Code as subagents and can be referenced in Cursor via `@file`.

| Agent                | Use For                                             |
| -------------------- | --------------------------------------------------- |
| `seo-expert`         | SEO audits, meta tags, structured data, sitemap     |
| `product-manager`    | Requirements coverage, TODO.md, feature gap analysis |
| `senior-engineer`    | Code review, architecture, coding standards         |
| `tech-writer`        | Documentation accuracy, stale references            |
| `automation-engineer`| Unit tests, integration tests, test infrastructure  |
| `manual-tester`      | Playwright browser testing, user journey validation |

**Cursor usage:** Reference with `@.claude/agents/seo-expert.md` in chat.

**Claude Code usage:** These are automatically available as subagents.
