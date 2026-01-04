---
paths: src/app/api/**/*.ts
---

# API Route Conventions

See `doc/arch/api.md` for full guidelines.

## Structure

- Use Next.js App Router route handlers
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Return `NextResponse.json()` for JSON responses

## Error Handling

- Return appropriate HTTP status codes
- Use consistent error response format:

```typescript
return NextResponse.json({ error: 'Description of error' }, { status: 400 })
```

## Authentication

- Check session in protected routes
- Use `getServerSession()` from next-auth
- Return 401 for unauthenticated, 403 for unauthorized

## Database

- Use functions from `src/lib/db.ts`
- Handle errors gracefully
- Use transactions for multi-step operations
