# Voting System Test Plan

## Overview

This document covers all test scenarios for the voting system, including cookie-based updates, fingerprint-based blocking, and UI behavior.

## Test Scenarios

### 1. First-Time Vote (Happy Path)

**Scenario**: User votes for the first time
**Expected Behavior**:

- ✅ Vote is recorded in database
- ✅ Cookie is set with vote data (bandId + bandName)
- ✅ Success message is displayed
- ✅ No "Already voted" message

**Test Steps**:

1. Clear all cookies and database votes
2. Navigate to voting page
3. Select a band and submit
4. Verify vote is recorded
5. Verify cookie is set with JSON data

### 2. Vote Update with Cookie (Happy Path)

**Scenario**: User has voted before and wants to change their vote
**Expected Behavior**:

- ✅ UI shows "You previously voted for [Band Name]"
- ✅ Previous choice is pre-selected
- ✅ Button shows "Update Vote" instead of "Submit Vote"
- ✅ New vote updates existing record (not creates new one)
- ✅ Cookie is updated with new vote data

**Test Steps**:

1. Vote for Band A
2. Reload page
3. Verify previous vote info is displayed
4. Select Band B and submit
5. Verify database shows updated vote (same record)
6. Verify cookie contains new vote data

### 3. Fingerprint Blocking (Security)

**Scenario**: Same person tries to vote from different browser/device
**Expected Behavior**:

- ✅ FingerprintJS detects same visitor
- ✅ Vote is blocked with "You have already voted" message
- ✅ No cookie is set
- ✅ No vote is recorded

**Test Steps**:

1. Vote from Browser A
2. Try to vote from Browser B (same person)
3. Verify vote is blocked
4. Verify no duplicate votes in database

### 4. Custom Fingerprint Fallback

**Scenario**: FingerprintJS fails, custom fingerprint is used
**Expected Behavior**:

- ✅ Custom fingerprint is generated
- ✅ Duplicate detection works with custom fingerprint
- ✅ Vote is processed normally

**Test Steps**:

1. Disable FingerprintJS (or simulate failure)
2. Vote normally
3. Try to vote again
4. Verify custom fingerprint blocks duplicate

### 5. Database Connection Consistency

**Scenario**: Ensure app and console use same database
**Expected Behavior**:

- ✅ Queries from app match console queries
- ✅ Data is consistent between app and console
- ✅ No phantom votes or missing data

**Test Steps**:

1. Vote through app
2. Check database via console
3. Verify vote appears in console
4. Delete vote via console
5. Verify vote disappears from app

### 6. UI State Management

**Scenario**: Proper UI states for different voting scenarios
**Expected Behavior**:

- ✅ "Already voted" page for fingerprint blocks
- ✅ Previous vote info for cookie updates
- ✅ Normal voting form for new votes
- ✅ Loading states during submission

**Test Steps**:

1. Test each UI state
2. Verify correct messages are shown
3. Verify form behavior matches state

## Edge Cases

### 7. Cookie Corruption

**Scenario**: Cookie contains invalid JSON
**Expected Behavior**:

- ✅ App handles gracefully
- ✅ Falls back to normal voting
- ✅ No crashes

### 8. Database Errors

**Scenario**: Database connection fails
**Expected Behavior**:

- ✅ Error is logged
- ✅ User sees "Failed to submit vote"
- ✅ No partial data corruption

### 9. Network Issues

**Scenario**: API request fails
**Expected Behavior**:

- ✅ Retry mechanism
- ✅ User feedback
- ✅ No duplicate submissions

## Test Data Setup

### Clean State

```sql
-- Clear all votes
DELETE FROM votes WHERE event_id = 'test-event-id';

-- Clear cookies (browser DevTools)
document.cookie.split(";").forEach(cookie => {
  if (cookie.trim().startsWith("voted_")) {
    const name = cookie.split("=")[0].trim();
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  }
});
```

### Test Event ID

- Event: `749db2c4-09e2-4e62-8ad8-0802960b4357`
- Bands: Multiple bands for selection testing

## Debugging Tools

### Server Logs

- FingerprintJS visitor ID
- Custom fingerprint values
- Database query results
- Cookie presence/absence

### Database Queries

```sql
-- Check all votes for event
SELECT * FROM votes WHERE event_id = 'event-id';

-- Check votes by fingerprint
SELECT * FROM votes WHERE fingerprintjs_visitor_id = 'visitor-id';

-- Check votes by custom fingerprint
SELECT * FROM votes WHERE vote_fingerprint = 'fingerprint';
```

### Browser DevTools

- Network tab for API calls
- Application tab for cookies
- Console for client-side logs

## Success Criteria

✅ All happy path scenarios work
✅ Security scenarios block appropriately  
✅ UI shows correct information
✅ Database remains consistent
✅ No phantom votes or missing data
✅ Error handling works gracefully
