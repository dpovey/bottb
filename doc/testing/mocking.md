# Mocking Strategies

## MSW (Mock Service Worker)

Setup: `src/__mocks__/server.ts`, `src/__mocks__/handlers.ts`

Handlers define API responses:

```typescript
http.get('/api/events', () => HttpResponse.json([...]))
http.post('/api/votes', () => HttpResponse.json({...}, { status: 201 }))
```

Override in tests:

```typescript
server.use(
  http.post('/api/votes', () =>
    HttpResponse.json({ error: '...' }, { status: 409 })
  )
)
```

## Database Mocking

```typescript
vi.mock('@/lib/db', () => ({
  getEvents: vi.fn(),
  getEventById: vi.fn()
}))

vi.mocked(getEvents).mockResolvedValue([...])
vi.mocked(getEvents).mockResolvedValueOnce([])  // Single call
```

Verify calls:

```typescript
expect(getEventById).toHaveBeenCalledWith('abc-123')
```

## Mock Data Factories

`src/__tests__/utils/mock-data.ts`:

- `createMockEvent(overrides)`
- `createMockBand(overrides)`
- `createMockVote(overrides)`
- `createMockPhoto(overrides)`

## Mocking Hooks

```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/events',
}))
```

## Mocking Time

```typescript
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-12-25'))
})
afterEach(() => vi.useRealTimers())

await vi.advanceTimersByTime(1000)
```

## Mocking Globals

Mock `window.matchMedia`, `IntersectionObserver`, `ResizeObserver` in setup file.
