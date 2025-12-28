# TypeScript Practices

## Configuration

- Strict mode enabled (`strict: true`)
- Path alias `@/*` maps to `./src/*`
- No emit (Next.js handles compilation)

## Rules

- Never use `any` - use `unknown` with type guards, generics, or specific types
- Prefix unused variables with `_` (e.g., `_error`, `_req`)
- Type all function parameters and return values
- Use `interface` for objects, `type` for unions/primitives

## Patterns

- **Interface-first**: Define interfaces for all data structures in `src/lib/db.ts`
- **Union types**: Use literal unions for finite states (`'upcoming' | 'voting' | 'finalized'`)
- **Discriminated unions**: For objects with different shapes based on a type field
- **Generics**: For reusable components and functions

## Component Props

- Required props have no `?`
- Optional props use `?` with default values
- Extend native HTML attributes when wrapping elements
- Callback props prefixed with `on` (onClick, onSelect)

## Async Functions

- Always specify return type (`Promise<T>`)
- Return `null` for "not found" cases, don't throw

## Type Assertions

- Prefer type guards over assertions
- Use `as` only when certain of the type
- Avoid non-null assertion (`!`)
