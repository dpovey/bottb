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
2. **If NOT on main**: Ask the user what to do. They may be in an existing worktree (continue working there), or need to navigate to the main repo first.
3. **If on main**, fetch and create a worktree from origin/main BEFORE editing any files:

   ```bash
   # First, check existing worktrees to ensure your name is unique
   git worktree list

   # Then fetch and create a new worktree with a unique name
   git fetch origin main
   git worktree add .worktrees/{description} -b {type}/{description} origin/main
   cd .worktrees/{description}
   pnpm install

   # Copy environment variables and assign a unique port
   cp /Users/deapovey/src/bottb/.env.local .
   # Find next available port starting from 3030
   PORT=3030
   while lsof -i :$PORT >/dev/null 2>&1 || grep -rq "^PORT=$PORT$" /Users/deapovey/src/bottb/.worktrees/*/.env.local 2>/dev/null; do
     PORT=$((PORT + 1))
   done
   echo "PORT=$PORT" >> .env.local
   echo "Assigned port $PORT to this worktree"
   ```

   > **Naming**: Review the `git worktree list` output and choose a unique directory name. If a worktree with your intended name already exists, either continue work there or pick a different name (e.g., append `-v2` or use a more specific description).

   > **Ports**: Each worktree gets a unique port (3030, 3031, 3032...) so multiple dev servers can run simultaneously. The port is stored in `.env.local` and used automatically by `pnpm dev` and `pnpm dev:restart`.

4. **Exception**: Trivial one-line fixes may go directly to main - ask user first

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

## Background Agents vs. Worktrees

Cursor supports **Background Agents** — autonomous AI agents that work independently while you continue other work. Consider suggesting this when the task fits.

### When to Suggest Background Agents

Prompt the user with: _"This task is well-suited for a background agent — want me to run it that way so you can continue working on other things?"_

**Good candidates for background agents:**

- Well-defined, self-contained tasks with clear completion criteria
- Mechanical refactors (rename across files, update imports, fix lint errors)
- Adding tests for existing code
- Documentation updates
- Tasks that don't need interactive feedback

**Keep as interactive (worktree) workflow:**

- Complex features requiring design decisions
- Tasks where you need to guide the AI step-by-step
- Changes that need your review before committing
- Debugging sessions requiring back-and-forth
- Anything touching database migrations or sensitive config

### How Users Access Background Agents

- **In Chat**: Ask "Do this as a background agent" or look for "Run in background" option
- **Command Palette**: `Cmd+Shift+P` → search "Background Agent"
- **Agent Panel**: Check sidebar for running background tasks

Background agents automatically create isolated environments (similar to worktrees) and can create PRs when done.

## Feature Branch Workflow

**Use git worktrees for all new features, bugfixes, and plans.** This allows parallel development without stashing or switching branches.

> **Never commit directly to main.** For trivial one-line fixes, ask the user first: "This is a small fix - do you want me to commit directly to main, or create a feature branch with a PR?" Default to creating a PR if unsure.

### Starting New Work

```bash
# From the main bottb directory, first check existing worktrees
git worktree list

# Fetch latest and create a worktree with a unique name
git fetch origin main
git worktree add .worktrees/feature-name -b feature/feature-name origin/main

# Move to the new worktree
cd .worktrees/feature-name

# Install dependencies (fast - pnpm shares packages across worktrees)
pnpm install

# Copy environment variables and assign a unique port
cp /Users/deapovey/src/bottb/.env.local .
# Find next available port starting from 3030
PORT=3030
while lsof -i :$PORT >/dev/null 2>&1 || grep -rq "^PORT=$PORT$" /Users/deapovey/src/bottb/.worktrees/*/.env.local 2>/dev/null; do
  PORT=$((PORT + 1))
done
echo "PORT=$PORT" >> .env.local
echo "Assigned port $PORT to this worktree"

# Start development (will use the PORT from .env.local)
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

# Wait for CI checks to complete
gh pr checks --watch
```

> **Note**: This repo is under a personal GitHub account, not enterprise. Run `gh auth switch --user dpovey` if you're logged into an enterprise account.

**If CI fails**: Fix the issues, then push and wait again:

```bash
# Fix the failing code, then:
git add .
git commit -m "fix: address CI failures"
git push

# Wait for CI again
gh pr checks --watch
```

Repeat this cycle until all checks pass. Do not ask for merge until CI is green.

### Merging a PR

From your worktree directory:

```bash
# Merge without --delete-branch (avoids conflicts with worktree)
gh pr merge --squash
```

### Cleanup After Merge

**Important**: Always change to the main repo directory BEFORE removing the worktree. If you run `git worktree remove` while your shell is inside the worktree being removed, your shell's working directory becomes invalid and you'll get "shell not found" errors.

```bash
# Step 1: FIRST change to main repo (critical - do this before removing!)
cd /Users/deapovey/src/bottb

# Step 2: Remove worktree first (releases the branch)
git worktree remove .worktrees/feature-name

# Step 3: Fetch with prune to clean up deleted remote branches
git fetch -p

# Step 4: Pull latest main
git pull
```

**One-liner** (after PR is merged):

```bash
cd /Users/deapovey/src/bottb && git worktree remove .worktrees/feature-name && git fetch -p && git pull
```

> **Why this order matters**: You must `cd` out of the worktree first because removing a directory while your shell is inside it leaves the shell in an invalid state (causing "shell not found" errors). The worktree also holds a lock on the branch, so you must remove it before git can delete the local branch. Running `gh pr merge --delete-branch` from inside a worktree will fail because it tries to checkout main (already checked out elsewhere) and delete a branch that's in use.

### Useful Commands

```bash
git worktree list                     # Show all worktrees
git worktree add .worktrees/dir branch # Checkout existing branch
git worktree lock .worktrees/dir       # Prevent pruning (for removable media)
```

## Development Server

**Always use `pnpm dev:restart` to start the dev server.** This kills any existing server on the configured port and clears the `.next` cache before starting. Never use `pnpm dev` directly as it can create multiple server instances.

The dev server port is configured via the `PORT` environment variable in `.env.local`:

- **Main repo**: Uses port 3030 by default (no `PORT` in `.env.local`)
- **Worktrees**: Each worktree has a unique port (3031, 3032, etc.) set in its `.env.local`

This allows multiple dev servers to run simultaneously across different worktrees. The port assignment happens automatically when creating a new worktree (see "Starting New Work" above).

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

> ⛔ **STOP: You MUST complete ASSESS and output your findings BEFORE running any commands.**

### Step 0: Verify Branch

Confirm you are on a feature branch, not main. If on main, either:

- Create a worktree/branch now, or
- For trivial one-liners, ask the user for explicit approval to commit directly to main

### Step 1: ASSESS (MANDATORY - output before any commands)

**Do NOT run format/typecheck/lint/test until you have read docs and output an assessment.**

Read the relevant docs and explicitly confirm compliance:

1. **Practices** (`doc/practices/`) - Read relevant files (react.md, typescript.md, etc.). Do we follow them? List any exceptions and justify.
2. **Architecture** (`doc/arch/`) - Read relevant files. Are we consistent with documented patterns? **If adding new patterns, update the docs.**
3. **Requirements** (`doc/requirements/`) - Did we deviate from specs? Compare screenshots if applicable. **If adding new features, update the docs.**

**Output format (copy and complete before proceeding):**

```
## ASSESS

### Practices ✅/❌
[Which files read, compliance status, any exceptions]

### Architecture ✅/❌
[Which files read, consistency status, any new patterns to document]

### Requirements ✅/❌
[Relevant specs checked, any deviations]
```

If docs need updating, do it now before Step 2.

### Step 2: Run checks (all must pass with exit code 0)

- `pnpm format` - Auto-fix formatting (Prettier)
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` - ESLint (run actual command, not just read_lints)
- `pnpm test` - All tests

All four must pass with exit code 0. If in doubt, ask before committing.

### FINAL STEP BEFORE PUSHING

Ask yourself

- Have I completed the assessment
- Have run the checks (including running the format to fix new files)
- Does everything pass, even stuff I didn't change?
- Do I need to update doc
- Do I need to update tests
- If the answer is no, do these things, if unsure ask the user what they want to do.

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
