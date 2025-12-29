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
2. **If on main**, create a worktree BEFORE editing any files:
   ```bash
   git worktree add .worktrees/{description} -b {type}/{description}
   cd .worktrees/{description}
   pnpm install
   cp ../.env.local .
   ```
3. **Exception**: Trivial one-line fixes may go directly to main - ask user first

Reading code to understand the task is fine. But NO edits until you're on a feature branch.

> **Why worktrees give you freedom**: Once on a feature branch, make changes confidently without asking for permission. Changes are isolated, reviewable in PR, and easy to discard. Only ask for clarification when the task is ambiguous, not for approval to proceed.

## Database Schema Changes

When modifying the database schema, **both files must be updated**:

1. **Create a migration** for production (Vercel/Neon):

   ```bash
   pnpm migrate:create add-foo-column
   # Edit migrations/TIMESTAMP_add-foo-column.js with your SQL
   pnpm migrate  # Apply to Vercel DB
   ```

2. **Update `src/lib/schema.sql`** to match the new schema (used for fresh test DBs)

3. **Update types** in `src/lib/db-types.ts` if needed

See `doc/arch/data-layer.md` for full migration workflow and schema evolution history.

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

## Feature Branch Workflow

**Use git worktrees for all new features, bugfixes, and plans.** This allows parallel development without stashing or switching branches.

> **Never commit directly to main.** For trivial one-line fixes, ask the user first: "This is a small fix - do you want me to commit directly to main, or create a feature branch with a PR?" Default to creating a PR if unsure.

### Starting New Work

```bash
# From the main bottb directory, create a worktree with a new branch
git worktree add .worktrees/feature-name -b feature/feature-name

# Move to the new worktree
cd .worktrees/feature-name

# Install dependencies (fast - pnpm shares packages across worktrees)
pnpm install

# Copy environment variables (not tracked by git)
cp ../.env.local .

# Start development
pnpm dev:restart
```

### Naming Convention

Worktree directories: `.worktrees/{short-description}`

Examples:

- `.worktrees/auth-fix` for branch `fix/auth-bug`
- `.worktrees/photo-upload` for branch `feature/photo-upload`
- `.worktrees/scoring-v2` for branch `refactor/scoring-v2`

### Creating a PR

```bash
# From your worktree directory
git add .
git commit -m "feat: description of changes"
git push -u origin feature/feature-name

# Switch to personal GitHub account (this repo uses personal, not enterprise)
gh auth switch --user dpovey
gh pr create --fill
```

> **Note**: This repo is under a personal GitHub account, not enterprise. Run `gh auth switch --user dpovey` if you're logged into an enterprise account.

### Cleanup After Merge

```bash
# From the worktree, return to main repo root
cd ../..
git pull

# Remove the worktree and branch
git worktree remove .worktrees/feature-name
git branch -d feature/feature-name

# Clean up stale references (optional)
git worktree prune
```

### Useful Commands

```bash
git worktree list                     # Show all worktrees
git worktree add .worktrees/dir branch # Checkout existing branch
git worktree lock .worktrees/dir       # Prevent pruning (for removable media)
```

## Development Server

**Always use `pnpm dev:restart` to start the dev server.** This kills any existing server on port 3000 and clears the `.next` cache before starting. Never use `pnpm dev` directly as it can create multiple server instances.

## Workflow

### When Designing New Features

1. Check `doc/requirements/` for existing feature specs
2. Review `DESIGN.md` for design patterns, tokens, and component guidelines
3. Browse `/design-system` in the app or run `pnpm storybook`
4. Look at screenshots in `doc/screenshots/` for visual consistency

### When Writing Code

1. Check `doc/arch/` for architectural patterns (data layer, API, components)
2. Follow `doc/practices/` for TypeScript, React, Next.js patterns
3. Use existing components from `src/components/ui/`

### Before Committing

Review changes against:

1. **Practices** - Do we follow them? If not, is the exception justified?
2. **Architecture** - Are we consistent with current patterns?
3. **Requirements** - Did we deviate from relevant specs? Compare relevant screenshots.
4. **Tests** - Consider the following:
   - Did we change any test behavior? Update affected tests.
   - Does new functionality need new unit/integration tests?
   - Could changes affect user-facing flows? Run and/or update Playwright e2e tests (`pnpm test:e2e`).
   - Check `e2e/` for specs that test affected routes/features.

**If major deviations found**: STOP and ask whether to update docs or fix code.

## Pre-commit Checklist

### Step 0: Verify Branch

Confirm you are on a feature branch, not main. If on main, either:

- Create a worktree/branch now, or
- For trivial one-liners, ask the user for explicit approval to commit directly to main

### Step 1: ASSESS (do this FIRST, before running any commands)

Read the relevant docs and explicitly confirm compliance:

1. **Practices** (`doc/practices/`) - Read relevant files (react.md, typescript.md, etc.). Do we follow them? List any exceptions and justify.
2. **Architecture** (`doc/arch/`) - Read relevant files. Are we consistent with documented patterns? **If adding new patterns, update the docs.**
3. **Requirements** (`doc/requirements/`) - Did we deviate from specs? Compare screenshots if applicable. **If adding new features, update the docs.**

Output your assessment with ✅/❌ for each area before proceeding. If docs need updating, do it now.

### Step 2: Run checks (all must pass with exit code 0)

- `pnpm format` - Auto-fix formatting (Prettier)
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` - ESLint (run actual command, not just read_lints)
- `pnpm test` - All tests

All four must pass with exit code 0. If in doubt, ask before committing.

### File-Scoped Commands

For faster validation during development:

- `pnpm exec tsc --noEmit path/to/file.ts` - Type check single file
- `pnpm exec prettier --write path/to/file.ts` - Format single file
- `pnpm exec eslint path/to/file.ts` - Lint single file
- `pnpm exec vitest run path/to/file.test.ts` - Run single test file

## Commit Message Format

- Use conventional commits: `<type>: <description>`
- Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build
- Keep descriptions concise - main thrust of why something changed
- Do not use scopes

## Testing

See `doc/testing/` for full testing documentation.

Key principles:

- Use React Testing Library for components
- Prefer ARIA queries (getByRole, getByLabelText) over data-testid
- Mock external dependencies with MSW
- Test behavior, not implementation details
- Use userEvent for interactions

## Code Style

See `doc/practices/` for full coding standards.

Key principles:

- TypeScript for all files, strict typing
- Never use `any` to fix type errors
- Prefix unused variables with underscore (`_error`)
- Follow existing codebase patterns
- Use shared components from `src/components/ui/`
