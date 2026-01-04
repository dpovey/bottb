# Git Worktree Workflow

This document details the git worktree workflow for parallel development without stashing or switching branches.

> **Never commit directly to main.** For trivial one-line fixes, ask the user first: "This is a small fix - do you want me to commit directly to main, or create a feature branch with a PR?" Default to creating a PR if unsure.

## Starting New Work

From the main bottb directory:

```bash
# First, check existing worktrees to ensure your name is unique
git worktree list

# Fetch latest and create a worktree with a unique name
git fetch origin main
git worktree add .worktrees/{description} -b {type}/{description} origin/main

# Move to the new worktree
cd .worktrees/{description}

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

> **Naming**: Review the `git worktree list` output and choose a unique directory name. If a worktree with your intended name already exists, either continue work there or pick a different name (e.g., append `-v2` or use a more specific description).

> **Ports**: Each worktree gets a unique port (3030, 3031, 3032...) so multiple dev servers can run simultaneously. The port is stored in `.env.local` and used automatically by `pnpm dev` and `pnpm dev:restart`.

### Naming Convention

Worktree directories: `.worktrees/{short-description}`

Examples:

- `.worktrees/auth-fix` for branch `fix/auth-bug`
- `.worktrees/photo-upload` for branch `feature/photo-upload`
- `.worktrees/scoring-v2` for branch `refactor/scoring-v2`

## Creating a PR

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

## Merging a PR

From your worktree directory:

```bash
# Merge without --delete-branch (avoids conflicts with worktree)
gh pr merge --squash
```

## Cleanup After Merge

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

## Useful Commands

```bash
git worktree list                      # Show all worktrees
git worktree add .worktrees/dir branch # Checkout existing branch
git worktree lock .worktrees/dir       # Prevent pruning (for removable media)
```
