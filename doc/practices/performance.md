# Performance Practices

## Server Components

- Default to server components (no client JS)
- Direct database access in server components
- Only use `'use client'` when necessary

## Data Fetching

- Parallel queries with `Promise.all()`
- Use finalized results cache for completed events
- `'use cache'` directive for cacheable functions

## Images

- Always use `next/image` component
- Provide `sizes` attribute
- Pre-generate thumbnail/large variants
- AVIF format priority (30-50% smaller)

## Bundle Size

- Next.js code-splits by route automatically
- Dynamic imports for heavy components
- Named imports for tree shaking

## React Performance

- **React Compiler handles memoization** - don't add manual useMemo/useCallback
- Keep components small
- Colocate state
- Stable keys for lists
- Virtualize long lists (1000+ items)

## Loading States

- Suspense boundaries for streaming
- Skeleton components during load
- Progressive image loading

## Caching

- Link prefetches on hover by default
- Cache-Control headers for static assets
- CDN caching for images

## Targets

- LCP < 2.5s
- FID < 100ms
- CLS < 0.1
- Lighthouse > 90

## Performance Monitoring

### Bundle Analysis

```bash
pnpm analyze      # Interactive UI on port 4000
pnpm analyze:ci   # Output to .next/diagnostics/analyze/
```

### Lighthouse Audits

```bash
# For accurate results, test against production build:
pnpm build
pnpm start &
pnpm lighthouse   # Outputs lighthouse-report.html and .json

# Dev mode gives misleading server response times (770ms vs 10ms in prod)
```
