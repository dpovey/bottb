# Band Deduplication Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the band deduplication feature, which allows users to select a company and see deduplicated band names, with the ability to query photos from multiple band instances (same name, different events).

## Feature Summary

When a company is selected and no event is selected:

- Bands with the same name are deduplicated (shown once)
- Different band names are shown separately
- Selecting a deduplicated band queries photos from all matching band IDs
- The system uses a special `bandIds:id1,id2` format internally and `bandIds=id1,id2` in URLs

## Test Coverage

### 1. Component Tests (`src/components/photos/__tests__/photo-filters.test.tsx`)

**Purpose**: Test the UI logic for band deduplication and selection handling.

**Test Cases**:

- ✅ Deduplicates bands with same name when company is selected (no event)
- ✅ Shows different band names separately for same company
- ✅ Sends all matching band IDs when deduplicated band is selected
- ✅ Does not deduplicate when event is selected
- ✅ Sends single band ID when non-deduplicated band is selected
- ✅ Displays correct value when `bandIds:` format is selected
- ✅ Displays correct value when single band ID is selected
- ✅ Handles 'none' band selection
- ✅ Handles clearing band selection
- ✅ Handles company with no bands
- ✅ Handles company with single band (no deduplication needed)
- ✅ Handles malformed `bandIds:` format gracefully

**Key Assertions**:

- Band dropdown shows deduplicated names correctly
- `onBandChange` is called with `bandIds:id1,id2` format for deduplicated bands
- `onBandChange` is called with single ID for non-deduplicated bands
- Select element displays correct value for both formats

### 2. Database Layer Tests (`src/lib/__tests__/db-photos-band-ids.test.ts`)

**Purpose**: Test SQL query generation and execution with multiple band IDs.

**Test Cases**:

- ✅ Queries photos with multiple band IDs using `ANY()` array syntax
- ✅ Handles single band ID normally
- ✅ Prefers `bandIds` over `bandId` when both are provided
- ✅ Handles empty `bandIds` array
- ✅ Counts photos with multiple band IDs
- ✅ Filters available options based on multiple band IDs
- ✅ Handles single band ID in available filters

**Key Assertions**:

- SQL queries use `ANY(array)` syntax for multiple IDs
- Single IDs use equality check
- Empty arrays don't filter
- All database functions (`getPhotos`, `getPhotoCount`, `getAvailablePhotoFilters`) handle `bandIds` correctly

### 3. API Route Tests (`src/app/api/photos/__tests__/route-band-ids.test.ts`)

**Purpose**: Test API parameter parsing and routing to database functions.

**Test Cases**:

- ✅ Parses `bandIds` parameter and passes to `getPhotos`
- ✅ Handles single `bandId` parameter (backward compatibility)
- ✅ Prefers `bandIds` over `band` when both are provided
- ✅ Passes `bandIds` to `getPhotoCount` and `getAvailablePhotoFilters`
- ✅ Handles empty `bandIds` parameter

**Key Assertions**:

- URL parameter `bandIds=id1,id2` is parsed correctly
- Comma-separated values are split into array
- All database functions receive correct parameters
- Backward compatibility with single `band` parameter is maintained

### 4. Integration Tests (`src/app/photos/__tests__/band-deduplication-integration.test.tsx`)

**Purpose**: Test end-to-end user flow from UI interaction to API calls.

**Test Cases**:

- ✅ Deduplicates bands and queries photos from multiple band IDs
- ✅ Handles URL with `bandIds` parameter on initial load

**Key Assertions**:

- User can select company, see deduplicated bands, select band, and API is called with `bandIds`
- URL parameters are correctly parsed and applied on page load
- Band select displays correct value when `bandIds` format is in URL

## Test Data Patterns

### Mock Bands for Testing

```typescript
// Same name, different events (should deduplicate)
{ id: "band1", event_id: "event1", name: "Jumbo Band", company_slug: "jumbo" }
{ id: "band2", event_id: "event2", name: "Jumbo Band", company_slug: "jumbo" }

// Different names (should show separately)
{ id: "band3", event_id: "event1", name: "Epsilon", company_slug: "epsilon" }
{ id: "band4", event_id: "event2", name: "Epsilon Band", company_slug: "epsilon" }
```

## Testing Scenarios

### Scenario 1: Happy Path - Deduplicated Band Selection

1. User selects "Jumbo" company
2. Band filter shows "Jumbo Band" once (deduplicated)
3. User selects "Jumbo Band"
4. System queries photos from both `band1` and `band2`
5. URL contains `bandIds=band1,band2`

**Tests**: Component test + Integration test

### Scenario 2: Different Band Names

1. User selects "Epsilon" company
2. Band filter shows both "Epsilon" and "Epsilon Band" separately
3. User selects "Epsilon"
4. System queries photos from only `band3`
5. URL contains `band=band3` (not `bandIds`)

**Tests**: Component test

### Scenario 3: Event Selected (No Deduplication)

1. User selects "Jumbo" company
2. User selects "Brisbane 2024" event
3. Band filter shows only bands from that event (no deduplication)
4. User selects "Jumbo Band"
5. System queries photos from only the band in that event

**Tests**: Component test

### Scenario 4: URL with bandIds on Load

1. User navigates to `/photos?company=jumbo&bandIds=band1,band2`
2. Page loads with company and band pre-selected
3. Band select shows correct value (first ID from `bandIds`)
4. Photos are queried with both band IDs

**Tests**: Integration test

## Edge Cases Covered

1. **Empty bandIds**: Handled gracefully, no filtering applied
2. **Single band for company**: No deduplication needed, single ID sent
3. **No bands for company**: Empty dropdown, no crash
4. **Malformed bandIds format**: Graceful handling, no crash
5. **Both bandIds and band in URL**: `bandIds` takes precedence
6. **Event selected**: Deduplication disabled, normal filtering

## Running Tests

```bash
# Run all band deduplication tests
npm test -- --grep "band.*dedup|Band.*Dedup"

# Run component tests
npm test -- src/components/photos/__tests__/photo-filters.test.tsx

# Run database tests
npm test -- src/lib/__tests__/db-photos-band-ids.test.ts

# Run API route tests
npm test -- src/app/api/photos/__tests__/route-band-ids.test.ts

# Run integration tests
npm test -- src/app/photos/__tests__/band-deduplication-integration.test.tsx

# Run with coverage
npm run test:coverage -- src/components/photos/__tests__/
```

## Test Maintenance

### When to Update Tests

1. **Adding new filter logic**: Add test cases for new scenarios
2. **Changing deduplication rules**: Update component tests
3. **Modifying SQL queries**: Update database tests
4. **Changing API parameters**: Update API route tests
5. **UI changes**: Update integration tests

### Test Organization

- **Unit tests**: Test individual functions/components in isolation
- **Integration tests**: Test component interactions and data flow
- **API tests**: Test request/response handling
- **Database tests**: Test SQL query generation and execution

## Coverage Goals

- **Statements**: 90%+ for band deduplication code paths
- **Branches**: 85%+ for conditional logic
- **Functions**: 100% for new functions
- **Lines**: 90%+ for new code

## Known Limitations

1. Tests use mocks for database calls - actual SQL syntax is not validated
2. Integration tests mock `fetch` - actual network behavior not tested
3. Some edge cases may require manual testing with real data

## Future Enhancements

1. Add E2E tests with Playwright/Cypress
2. Add performance tests for large band lists
3. Add tests for concurrent filter changes
4. Add tests for browser back/forward navigation
5. Add visual regression tests for UI changes
