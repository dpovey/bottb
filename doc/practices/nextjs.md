# Next.js Practices

## App Router

- All pages under `src/app/`
- Dynamic routes: `[param]` folders
- Route groups: `(group)` folders (don't affect URL)
- API routes: `route.ts` files

## Pages

- Server components by default - fetch data directly
- `params` is a Promise in Next.js 15+ (must await)
- Use `notFound()` for missing resources
- Export `metadata` or `generateMetadata` for SEO

## Layouts

- `layout.tsx` wraps child routes
- Root layout must include `<html>` and `<body>`
- Nested layouts for section-specific UI (e.g., admin sidebar)
- Use layouts for auth checks (redirect if not logged in)

## Route Handlers (API)

- Export `GET`, `POST`, `PATCH`, `DELETE` functions
- Use `NextRequest` and `NextResponse`
- `params` is a Promise (must await)
- Return proper status codes

## Data Fetching

- Server components: direct database access
- Parallel fetching: `Promise.all()` for independent queries
- Client-side: SWR for polling/real-time data

## Loading & Errors

- `loading.tsx` for route-level loading states
- `error.tsx` for route-level error handling (must be client component)
- `not-found.tsx` for 404 pages

## Caching

- `'use cache'` directive for cacheable functions
- `cacheLife()` for cache duration profiles
- Finalized results cached, live scores calculated

## Navigation

- `Link` component for client-side navigation
- `useRouter` for programmatic navigation
- `router.refresh()` to re-fetch server components

## Images

- Always use `next/image` component
- Provide `sizes` attribute for responsive images
- Use `fill` with `object-cover` for hero images

## Middleware

- `middleware.ts` at project root
- Use for auth redirects
- Config `matcher` to limit routes
