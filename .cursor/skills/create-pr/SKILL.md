---
name: create-pr
description: Create and submit a pull request from a worktree branch. Use after completing work and passing all checks.
---

# Create Pull Request

Submit a PR from your feature branch and wait for CI.

## When to Use

- After completing work on a feature branch
- After all pre-commit checks pass
- When ready to submit for review

## Prerequisites

- On a feature branch (not main)
- All checks passing: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`

## Instructions

### 1. Commit Changes

```bash
git add .
git commit -m "{type}: {description}"
```

Use conventional commit types: feat, fix, docs, style, refactor, test, chore, perf, ci, build

### 2. Push Branch

```bash
git push -u origin {branch-name}
```

### 3. Create PR

```bash
# Switch to personal GitHub account (this repo uses personal, not enterprise)
gh auth switch --user dpovey
gh pr create --fill
```

### 4. Wait for CI

```bash
gh pr checks --watch
```

### 5. If CI Fails

Fix the issues, then push and wait again:

```bash
# Fix the failing code, then:
git add .
git commit -m "fix: address CI failures"
git push

# Wait for CI again
gh pr checks --watch
```

Repeat until all checks pass. Do not request merge until CI is green.

### 6. Merge (After Approval)

```bash
# Squash merge (do NOT use --delete-branch from inside worktree)
gh pr merge --squash
```

### 7. Cleanup

```bash
# CRITICAL: Change to main repo FIRST
cd /Users/deapovey/src/bottb

# Remove worktree, fetch, pull
git worktree remove .worktrees/{description}
git fetch -p
git pull
```

## Reference

See `doc/agent/workflow.md` for the full workflow documentation.
