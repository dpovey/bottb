# Unit Testing Plan for Battle of the Tech Bands

## Overview

This document outlines a comprehensive unit testing strategy for the Battle of the Tech Bands application using React Testing Library and Jest.

## Testing Philosophy

- **User-centric testing**: Test behavior from the user's perspective
- **ARIA-first approach**: Use semantic queries over data-testid
- **Comprehensive coverage**: Test all major functionality and edge cases
- **Maintainable tests**: Write clear, focused, and maintainable test suites

## Test Structure

### 1. Database Layer Tests (`lib/db.ts`)

**Functions to test:**

- `getEvents()`
- `getActiveEvent()`
- `getUpcomingEvents()`
- `getPastEvents()`
- `getBandsForEvent(eventId)`
- `getVotesForEvent(eventId)`
- `submitVote(vote)`
- `getEventById(eventId)`
- `getBandScores(eventId)`

**Test approach:**

- Mock `@vercel/postgres` sql calls
- Test success and error scenarios
- Verify correct SQL queries are generated
- Test data transformation and return types

### 2. Utility Functions (`lib/date-utils.ts`)

**Functions to test:**

- `formatEventDate(dateString)`
- `getOrdinalSuffix(day)` (private function)

**Test cases:**

- Various date formats and edge cases
- Ordinal suffix generation (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, etc.)
- Time formatting (AM/PM)
- Invalid date handling

### 3. API Routes Tests

**Routes to test:**

- `GET /api/events/[eventId]`
- `GET /api/bands/[eventId]`
- `POST /api/votes`
- `POST /api/votes/batch`
- `GET /api/events/active`
- `GET /api/events/past`
- `GET /api/events/upcoming`
- `GET /api/events/[eventId]/scores`

**Test approach:**

- Mock database functions
- Test HTTP status codes and responses
- Test error handling
- Test request validation

### 4. Page Component Tests

#### Home Page (`app/page.tsx`)

**Test scenarios:**

- Renders upcoming events when available
- Renders active event with bands
- Renders past events with winners
- Shows "No upcoming events" when none exist
- Displays correct relative dates
- Shows voting links for voting events
- Shows results links for finalized events

#### Event Page (`app/event/[eventId]/page.tsx`)

**Test scenarios:**

- Renders event details correctly
- Shows bands list
- Displays correct status badges
- Shows appropriate action buttons based on status
- Handles loading and error states
- Shows "No bands" message when empty

#### Admin Page (`app/event/[eventId]/admin/page.tsx`)

**Test scenarios:**

- Renders admin interface
- Shows QR code links for voting and judging
- Displays management actions
- Handles loading states

#### Band Detail Page (`app/band/[bandId]/page.tsx`)

**Test scenarios:**

- Renders band information
- Displays score breakdowns
- Shows progress bars with correct percentages
- Calculates scores correctly
- Handles missing band data
- Shows back navigation

#### Results Page (`app/results/[eventId]/page.tsx`)

**Test scenarios:**

- Renders overall winner
- Shows category winners
- Displays complete results table
- Handles no results state
- Redirects non-finalized events
- Shows individual band links

### 5. Voting Component Tests

#### Crowd Voting (`app/vote/crowd/[eventId]/page.tsx`)

**Test scenarios:**

- Renders band selection form
- Allows band selection via radio buttons
- Submits vote successfully
- Shows success message after submission
- Handles submission errors
- Prevents multiple submissions
- Shows loading state during submission

#### Judge Voting (`app/vote/judge/[eventId]/page.tsx`)

**Test scenarios:**

- Renders scoring form for all bands
- Allows score input via sliders
- Validates all scores are provided
- Submits all scores in batch
- Shows success message after submission
- Handles submission errors
- Prevents submission with incomplete scores
- Shows loading state during submission

### 6. QR Code Pages

**Test scenarios:**

- Renders QR codes correctly
- Shows appropriate instructions
- Handles different event states

## Test Utilities and Setup

### Custom Render Function

```typescript
// __tests__/utils/test-utils.tsx
import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    // Add any providers needed for testing
    <>{children}</>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };
```

### Mock Data Factories

```typescript
// __tests__/utils/mock-data.ts
export const createMockEvent = (overrides = {}) => ({
  id: "event-1",
  name: "Test Event",
  date: "2024-12-25T18:30:00Z",
  location: "Test Venue",
  is_active: true,
  status: "voting" as const,
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

export const createMockBand = (overrides = {}) => ({
  id: "band-1",
  event_id: "event-1",
  name: "Test Band",
  description: "A test band",
  order: 1,
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});
```

### MSW Handlers

```typescript
// __tests__/mocks/handlers.ts
import { rest } from "msw";

export const handlers = [
  rest.get("/api/events/:eventId", (req, res, ctx) => {
    return res(ctx.json(createMockEvent()));
  }),
  rest.get("/api/bands/:eventId", (req, res, ctx) => {
    return res(ctx.json([createMockBand()]));
  }),
  rest.post("/api/votes", (req, res, ctx) => {
    return res(ctx.json({ id: "vote-1", ...req.body }));
  }),
];
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

### Test Setup

```javascript
// jest.setup.js
import "@testing-library/jest-dom";
import { server } from "./src/__mocks__/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Implementation Priority

1. **Phase 1**: Database functions and utilities
2. **Phase 2**: API routes
3. **Phase 3**: Core page components
4. **Phase 4**: Voting components
5. **Phase 5**: Results and admin components
6. **Phase 6**: Integration tests

## Coverage Goals

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

## Testing Commands

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:ci": "jest --ci --coverage --watchAll=false"
}
```

## Notes

- All tests should be deterministic and not depend on external services
- Use MSW for API mocking to ensure reliable tests
- Focus on testing user interactions and business logic
- Avoid testing implementation details
- Use meaningful test descriptions that explain the expected behavior













