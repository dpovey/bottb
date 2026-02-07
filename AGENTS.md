# Agent Guidelines

> **Cursor users**: Rules, subagents, and skills are in `.cursor/`. This file serves as a compatible overview for all AI agents.

## Project Overview

Battle of the Tech Bands (BOTTB) - a Next.js 16 / React 19 application for tech band competitions with voting, photos, and results.

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

## Agent Configuration

### Rules (`.cursor/rules/`)

Declarative standards that are always active or scoped to file patterns:

| Rule             | Scope                        | Purpose                                         |
| ---------------- | ---------------------------- | ----------------------------------------------- |
| `global.mdc`     | Always                       | Project identity, tech stack, code style        |
| `workflow.mdc`   | Always                       | Branch workflow, pre-commit, context management |
| `typescript.mdc` | `src/**/*.ts(x)`             | TypeScript and React conventions                |
| `components.mdc` | `src/components/**/*.tsx`    | Component structure, styling, testing           |
| `api-routes.mdc` | `src/app/api/**/*.ts`        | API route conventions                           |
| `database.mdc`   | `src/lib/db*`, `migrations/` | Database and migration conventions              |

### Subagents (`.cursor/agents/`)

Specialized agents that operate in their own context window for focused tasks:

| Agent                 | Use For                                                     |
| --------------------- | ----------------------------------------------------------- |
| `senior-engineer`     | Code review, architecture, coding standards                 |
| `automation-engineer` | Unit tests, integration tests, test infrastructure          |
| `manual-tester`       | Playwright browser testing, user journey validation         |
| `product-manager`     | Requirements coverage, TODO.md, feature gap analysis        |
| `seo-expert`          | SEO audits, meta tags, structured data, sitemap             |
| `tech-writer`         | Documentation accuracy, stale references                    |
| `pre-commit-reviewer` | Assess code changes against project standards before commit |

### Skills (`.cursor/skills/`)

Step-by-step procedural workflows invoked on demand:

| Skill              | Use For                                                |
| ------------------ | ------------------------------------------------------ |
| `worktree-setup`   | Creating a git worktree for isolated development       |
| `pre-commit`       | Running assessment and checks before committing        |
| `create-migration` | Database schema changes with proper migration workflow |
| `create-pr`        | Submitting a pull request and waiting for CI           |

## Before Starting Any Work

**STOP and do this BEFORE making any code edits:**

1. **Check current branch**: `git branch --show-current`
2. **If NOT on main**: Ask the user what to do (continue in existing worktree, or navigate to main repo first)
3. **If on main**: Create a worktree in `.worktrees/` BEFORE editing files (see `doc/agent/workflow.md`)
4. **Exception**: Trivial one-line fixes may go directly to main - ask user first

Reading code to understand the task is fine. But NO edits until you're on a feature branch.

### Creating a Worktree

```bash
cd /Users/deapovey/src/bottb
git fetch origin main
git worktree add .worktrees/{name} -b {type}/{name} origin/main
cd .worktrees/{name}
pnpm install
cp /Users/deapovey/src/bottb/.env.local .
echo "PORT=3031" >> .env.local  # Use unique port (3031, 3032, etc.)
```

**Branch naming**: `{type}/{description}` where type is feat, fix, chore, refactor, etc.

See [doc/agent/workflow.md](doc/agent/workflow.md) for full setup instructions.

## Documentation

Before making changes, consult the relevant documentation:

| Phase                  | Docs to Reference                |
| ---------------------- | -------------------------------- |
| **Designing features** | `DESIGN.md`, `doc/requirements/` |
| **Writing code**       | `doc/arch/`, `doc/practices/`    |
| **Before commit**      | All of the above                 |

## Pre-commit Checklist

> **Stop and assess before running any commands.**

### Assess (Mandatory)

Read relevant docs and confirm compliance. Output findings before proceeding:

1. **Practices** (`doc/practices/`) - Do we follow them? List any exceptions and justify.
2. **Architecture** (`doc/arch/`) - Consistent with patterns? If adding new patterns, update the docs.
3. **Requirements** (`doc/requirements/`) - Any deviations from specs?
4. **Scope** - Did you make any changes unrelated to this task?
5. **Impact** - Are there other parts of the codebase potentially affected by this change?

### Run Checks

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
```

All must pass with exit code 0. See [doc/agent/checklist.md](doc/agent/checklist.md) for details.

## Code Style

- TypeScript for all files, strict typing
- Never use `any` to fix type errors
- Prefix unused variables with underscore (`_error`)
- Use shared components from `src/components/ui/`
- **No manual memoization** - React Compiler handles `useMemo`/`useCallback`/`React.memo`

See `doc/practices/` for full coding standards.

## Commit Messages

Use conventional commits: `<type>: <description>`

Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build

## Development Server

**Always use `pnpm dev:restart`** to start the dev server.

- Main repo: Port 3030 (default)
- Worktrees: Unique ports (3031, 3032...) set in `.env.local`

## When Things Go Wrong

- **Merge conflict**: Stop and ask user - don't attempt auto-resolution
- **CI failure**: Read full error output, fix locally, push again
- **Database schema drift**: Run `pnpm migrate:latest`, compare with `schema.sql`
- **Port conflict**: `lsof -i :3030` to find process, then kill or use different port
- **Tests failing on unchanged code**: Ask user before proceeding
