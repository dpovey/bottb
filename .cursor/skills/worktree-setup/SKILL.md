---
name: worktree-setup
description: Create a git worktree for isolated feature development. Use when starting new work, creating feature branches, or setting up parallel development environments.
---

# Worktree Setup

Create and configure a git worktree for isolated feature development.

## When to Use

- Starting any new feature, fix, or refactor
- When on `main` branch and need to make code changes
- Setting up parallel development environments

## Instructions

### 1. Navigate to Main Repo

```bash
cd /Users/deapovey/src/bottb
```

### 2. Check Existing Worktrees

```bash
git worktree list
```

Ensure your intended directory name is unique. If it exists, either continue there or pick a different name (append `-v2` or use a more specific description).

### 3. Create the Worktree

```bash
git fetch origin main
git worktree add .worktrees/{description} -b {type}/{description} origin/main
```

**Branch naming**: `{type}/{description}` where type is one of: feat, fix, chore, refactor, docs, test, perf

**Directory naming**: `.worktrees/{short-description}`

Examples:
- `.worktrees/auth-fix` for branch `fix/auth-fix`
- `.worktrees/photo-upload` for branch `feat/photo-upload`
- `.worktrees/scoring-v2` for branch `refactor/scoring-v2`

### 4. Set Up the Worktree

```bash
cd .worktrees/{description}

# Install dependencies (fast - pnpm shares packages across worktrees)
pnpm install

# Copy environment variables
cp /Users/deapovey/src/bottb/.env.local .

# Assign a unique port (auto-detect next available)
PORT=3030
while lsof -i :$PORT >/dev/null 2>&1 || grep -rq "^PORT=$PORT$" /Users/deapovey/src/bottb/.worktrees/*/.env.local 2>/dev/null; do
  PORT=$((PORT + 1))
done
echo "PORT=$PORT" >> .env.local
echo "Assigned port $PORT to this worktree"
```

### 5. Start Development

```bash
pnpm dev:restart
```

## Cleanup After Merge

After a PR is merged:

```bash
# CRITICAL: Change to main repo FIRST (before removing worktree)
cd /Users/deapovey/src/bottb

# Remove worktree, fetch with prune, pull latest
git worktree remove .worktrees/{description}
git fetch -p
git pull
```

## Reference

See `doc/agent/workflow.md` for the full workflow including PR creation and CI.
