# Pre-commit Checklist

> ⛔ **STOP: You MUST complete the Assess step and output your findings BEFORE running any commands.**

## Step 0: Verify Branch

Confirm you are on a feature branch, not main. If on main, either:

- Create a worktree/branch now (see [workflow.md](workflow.md)), or
- For trivial one-liners, ask the user for explicit approval to commit directly to main

## Step 1: Assess (Mandatory - output before any commands)

**Do NOT run format/typecheck/lint/test until you have read docs and output an assessment.**

Read the relevant docs and explicitly confirm compliance:

1. **Practices** (`doc/practices/`) - Read relevant files (react.md, typescript.md, etc.). Do we follow them? List any exceptions and justify.
2. **Architecture** (`doc/arch/`) - Read relevant files. Are we consistent with documented patterns? **If adding new patterns, update the docs.**
3. **Requirements** (`doc/requirements/`) - Did we deviate from specs? Compare screenshots if applicable. **If adding new features, update the docs.**
4. **Scope** - Did you make any changes to code unrelated to this task? If so, list them.
5. **Impact** - Are there other parts of the codebase potentially affected by this change? If so, list them.

**Output format (copy and complete before proceeding):**

```
## Assess

### Practices ✅/❌
[Which files read, compliance status, any exceptions]

### Architecture ✅/❌
[Which files read, consistency status, any new patterns to document]

### Requirements ✅/❌
[Relevant specs checked, any deviations]

### Scope ✅/❌
[Unrelated changes: none / list them]

### Impact ✅/❌
[Other affected areas: none / list them]
```

If docs need updating, do it now before Step 2.

## Step 2: Run checks (all must pass with exit code 0)

- `pnpm format` - Auto-fix formatting (Prettier)
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` - ESLint (run actual command, not just read_lints)
- `pnpm test` - All tests

All four must pass with exit code 0. If in doubt, ask before committing.

## Final Step Before Pushing

Ask yourself:

- Have I completed the assessment?
- Have I run the checks (including running format to fix new files)?
- Does everything pass, even stuff I didn't change?
- Do I need to update docs?
- Do I need to update tests?

If the answer is no to any, do those things. If unsure, ask the user what they want to do.

## File-Scoped Commands

For faster validation during development:

- `pnpm exec tsc --noEmit path/to/file.ts` - Type check single file
- `pnpm exec prettier --write path/to/file.ts` - Format single file
- `pnpm exec eslint path/to/file.ts` - Lint single file
- `pnpm exec vitest run path/to/file.test.ts` - Run single test file
