# API Testing

Testing Next.js Route Handlers.

## Setup

Mock database at top of test file:

```typescript
vi.mock('@/lib/db', () => ({
  getEventById: vi.fn(),
}))
```

Create test requests:

```typescript
const request = new NextRequest(new URL(url, 'http://localhost'), options)
```

## Testing GET Routes

- Mock database return value
- Call handler with request and params
- Assert response status and body
- Test 404 for missing resources
- Test 500 for database errors

## Testing POST Routes

- Include method, body, headers in request
- Test 201 for successful creation
- Test 400 for invalid input
- Test 409 for duplicates (votes)

## Testing Protected Routes

- Mock `auth()` to return null → expect 401
- Mock `auth()` to return session → test normal flow

## Testing Query Parameters

```typescript
const request = createRequest('/api/photos?eventId=123&limit=10')
```

Verify database called with correct filters.

## Testing Rate Limiting

- Make requests up to limit → success
- Exceed limit → expect 429

## Response Assertions

- Check `response.status`
- Check `await response.json()`
- Check `response.headers.get('Cache-Control')`
