# Authentication

Admin authentication with NextAuth.js v5.

## Overview

- **Provider**: NextAuth.js with Credentials
- **Strategy**: Email/password
- **Password**: bcrypt (10 salt rounds)
- **Session**: JWT tokens (30-day expiry)

## Key Files

- `src/lib/auth.ts`: NextAuth configuration
- `src/lib/password-auth.ts`: Password utilities
- `src/lib/middleware-auth.ts`: API protection
- `middleware.ts`: Route protection

## Route Protection

**Middleware** protects `/admin/*` routes:

- Redirects unauthenticated users to `/admin/login`
- Excludes `/admin/login` from protection

**API Routes** use `requireAuth()`:

- Returns 401 if not authenticated
- Returns session for authorized requests

## User Management

CLI tool: `pnpm manage-users`

- Create admin users
- Update passwords
- List/delete users

## Admin Features

| Path                          | Description      |
| ----------------------------- | ---------------- |
| `/admin`                      | Dashboard        |
| `/admin/events`               | Event management |
| `/admin/events/[id]/setlists` | Setlist editor   |
| `/admin/videos`               | Video management |
| `/admin/social`               | Social accounts  |

## Security

- Password hashing with bcrypt
- HTTPS-only cookies in production
- HttpOnly session cookies
- CSRF protection via NextAuth
- Rate limiting on login attempts
