---
name: pre-commit
description: Run the pre-commit assessment and checks before committing code. Use before any git commit to ensure compliance with project standards.
---

# Pre-commit Checklist

Complete assessment and run all checks before committing.

## When to Use

- Before every `git commit`
- After finishing a feature or fix
- When asked to "check" or "verify" code

## Step 0: Verify Branch

```bash
git branch --show-current
```

Confirm you are on a feature branch, not main. If on main, use the `/worktree-setup` skill first.

## Step 1: Assess + Check (Parallel)

These two steps are independent and should run simultaneously:

### 1a. Assess (delegate to `pre-commit-reviewer` subagent)

The `pre-commit-reviewer` subagent reads the relevant docs and reviews your changes in its own context window. This keeps the doc-reading overhead out of the main conversation.

It checks: practices compliance, architecture consistency, requirements coverage, scope, and impact.

### 1b. Run Checks (in parallel with assess)

All must pass with exit code 0:

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm test
```

If the assessment identifies docs that need updating, do it now before committing.

### File-Scoped Commands (for faster iteration)

```bash
pnpm exec tsc --noEmit path/to/file.ts      # Type check single file
pnpm exec prettier --write path/to/file.ts   # Format single file
pnpm exec eslint path/to/file.ts             # Lint single file
pnpm exec vitest run path/to/file.test.ts    # Run single test file
```

## Step 3: Final Verification

Before pushing, confirm:

- Assessment completed and output
- All four checks pass (format, typecheck, lint, test)
- Docs updated if needed
- Tests updated if needed
- No unrelated changes included

## Reference

See `doc/agent/checklist.md` for additional details.
