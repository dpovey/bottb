# Security Practices

## Authentication

- NextAuth.js with credentials provider
- bcrypt password hashing (10 salt rounds)
- JWT sessions (30-day expiry)
- Middleware protects admin routes

## Route Protection

- All `/admin/*` routes require authentication
- Middleware redirects unauthenticated users to login
- API routes check session with `auth()`

## Security Headers

- Strict-Transport-Security (HSTS)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Content-Security-Policy configured
- Referrer-Policy: strict-origin-when-cross-origin

## Rate Limiting

- `/api/votes`: 10/min (public)
- `/api/photos/[id]/jpeg`: 20/min (downloads)
- Admin endpoints: higher limits

## Input Validation

- Validate all request body fields
- Check numeric ranges
- Type checking before database operations

## SQL Injection Prevention

- Always use parameterized queries (template literals with @vercel/postgres)
- Never string interpolate user input

## Token Security

- OAuth tokens encrypted with AES-256-GCM
- Encryption keys in environment variables
- Never commit secrets

## Double Voting Prevention

1. FingerprintJS browser fingerprint
2. Custom fingerprint (IP + User Agent hash)
3. Cookie tracking
4. Database duplicate checks

## Error Handling

- Log errors server-side
- Return generic messages to client
- Never expose stack traces or internal details

## Privacy

- No PII in analytics
- Fingerprints hashed, not stored raw
- Secure cookie settings (httpOnly, secure, sameSite)
