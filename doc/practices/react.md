# React Practices

## Components

- Function components only (no class components)
- Server components by default (no directive needed)
- `'use client'` only when needing: state, effects, browser APIs, event handlers

## Hooks

- Call at top level only (not conditionally)
- Custom hooks start with `use` prefix
- Extract reusable logic into custom hooks

## State Management

- Local state: `useState` for component-specific
- Lifted state: Share state via nearest common ancestor
- URL state: `useSearchParams` for shareable/bookmarkable state

## Composition

- Prefer children pattern over many props
- Build compound components (Card + CardHeader + CardContent)
- Use render props sparingly, only when needed

## Performance

- **React Compiler is enabled** - don't manually add `useMemo`, `useCallback`, `React.memo`
- Keep components small
- Use stable keys for lists
- Colocate state near where it's used

## Naming

- Handler functions: `handleClick`, `handleSubmit`
- Callback props: `onClick`, `onSelect`
- Boolean props: `isLoading`, `hasError`

## Error Boundaries

- Wrap sections with error boundaries for graceful degradation
- Use Next.js `error.tsx` for route-level errors

## ForwardRef

- Use when components need to expose refs to parents
- Set `displayName` for debugging
