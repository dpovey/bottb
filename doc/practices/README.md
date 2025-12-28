# Development Practices

## Quick Reference

### TypeScript

- Strict mode enabled
- No `any` types - use `unknown` or specific types
- Prefix unused variables with `_`
- Interface-first design for data types
- Union types for finite states

### React

- Function components with hooks only
- Server components by default
- `'use client'` only when needing state/effects/browser APIs
- React Compiler handles memoization - don't manually add useMemo/useCallback

### Next.js

- App Router (not Pages Router)
- Server components for data fetching
- Route handlers for APIs
- Metadata exports for SEO

### Styling

- Tailwind CSS utilities (no custom CSS classes)
- `cn()` utility for conditional classes
- Mobile-first responsive design
- Dark mode only (no light mode)

### Code Quality

```bash
# Must pass before commit
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
```

### Commits

- Format: `<type>: <description>`
- Types: feat, fix, docs, style, refactor, test, chore

### File Naming

- Components: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts`
- Utilities: `kebab-case.ts`
- Tests: `.test.tsx` suffix
- Stories: `.stories.tsx` suffix
