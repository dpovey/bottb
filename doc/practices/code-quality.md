# Code Quality Practices

## Pre-Commit Checklist

**Must pass before committing:**

```bash
npm run format:check   # Prettier
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm test               # Vitest
```

## Prettier

- Semi: false
- Single quotes
- Trailing commas: es5
- Tab width: 2
- Print width: 80

## ESLint

- No unused vars (prefix with `_` if intentional)
- No explicit `any`
- React hooks rules enforced
- Effect dependency checking

## Commit Messages

Format: `<type>: <description>`

Types:

- `feat`: New user-facing feature
- `fix`: Bug fix
- `refactor`: Code change without feature/fix
- `test`: Adding/updating tests
- `docs`, `style`, `chore`, `perf`, `ci`, `build`

Keep descriptions concise (50-72 chars).

## Import Order

1. External packages (react, next)
2. Internal aliases (@/components, @/lib)
3. Relative imports (./utils)

## File Organization

- Imports at top
- Types/interfaces
- Component function
- Sub-components
- Exports at bottom

## Code Review Checklist

- Pre-commit checks pass
- No `any` types
- Tests for new functionality
- Stories for new UI components
- No console.log statements
- Error handling implemented
