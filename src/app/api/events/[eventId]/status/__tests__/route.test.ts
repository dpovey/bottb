import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { ProtectedApiHandler } from '@/lib/api-protection'

vi.mock('@/lib/db', () => ({
  updateEventStatus: vi.fn(),
}))

vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))

vi.mock('@/lib/api-protection', () => ({
  withAdminProtection: (handler: ProtectedApiHandler) => handler,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import { updateEventStatus } from '@/lib/db'
import { sql, sqlQuery } from '@/lib/sql'
import { PATCH } from '../route'

function request(body: unknown): NextRequest {
  return {
    url: 'http://localhost:3000/api/events/test-event-1/status',
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

/**
 * The route is retired: statuses only change through the guarded lifecycle
 * steps on "Run the night". An old admin page that still calls it gets an
 * explanation and nothing changes.
 */
describe('PATCH /api/events/[eventId]/status (retired)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['a valid status', { status: 'voting' }],
    ['finalized', { status: 'finalized' }],
    ['an invalid status', { status: 'invalid-status' }],
    ['no status', {}],
    ['no body', null],
  ])('answers 410 and changes nothing for %s', async (_label, body) => {
    const response = await PATCH(request(body), {})
    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({
      error:
        'Event status is now changed from the "Run the night" page. Reload this page to get it.',
    })
    expect(updateEventStatus).not.toHaveBeenCalled()
    expect(sql).not.toHaveBeenCalled()
    expect(sqlQuery).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
