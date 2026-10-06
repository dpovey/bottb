// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import type { Session } from 'next-auth'
import type { ProtectedApiHandler } from '@/lib/api-protection'

const auth = vi.hoisted(() => ({ session: null as Session | null }))

vi.mock('@/lib/api-protection', () => ({
  withAdminProtection:
    (handler: ProtectedApiHandler) =>
    (request: NextRequest, context?: unknown) =>
      handler(request, context, auth.session ?? undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/sql', () => ({ sql: vi.fn(), sqlQuery: vi.fn() }))

// Keep the real getPathsToRevalidate; only the transition itself is mocked.
vi.mock('@/lib/night', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/night')>()),
  performTransition: vi.fn(),
}))

import { revalidatePath, revalidateTag } from 'next/cache'
import { performTransition, type TransitionResult } from '@/lib/night'
import type { NightState } from '@/lib/night-types'
import { POST } from '../route'

const mockPerform = vi.mocked(performTransition)
const EVENT_ID = 'sydney-2026'

function request(body: unknown, invalidJson = false): NextRequest {
  return {
    json: invalidJson
      ? vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      : vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

const context = { params: Promise.resolve({ eventId: EVENT_ID }) }

function adminSession(user: Partial<Session['user']>): Session {
  return {
    user: { isAdmin: true, ...user },
    expires: '2099-01-01T00:00:00Z',
  } as Session
}

const state = {
  event: { id: EVENT_ID, status: 'closed' },
  generatedAt: '2026-10-08T10:00:00.000Z',
} as unknown as NightState

async function post(body: unknown, invalidJson = false) {
  const response = await POST(request(body, invalidJson), context)
  return { status: response.status, body: await response.json() }
}

describe('POST /api/events/[eventId]/night/transition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // One test makes revalidatePath throw; start every test with it working.
    vi.mocked(revalidatePath).mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.session = adminSession({ email: 'admin@example.com', name: 'Admin' })
  })

  describe('bad requests', () => {
    it.each([
      ['an unknown transition', { transition: 'finalize' }],
      ['a missing transition', {}],
      ['a non-string transition', { transition: 3 }],
      ['a null body', null],
      ['"constructor"', { transition: 'constructor' }],
      ['"toString"', { transition: 'toString' }],
      ['"__proto__"', { transition: '__proto__' }],
    ])('answers 400 for %s', async (_label, body) => {
      const { status, body: data } = await post(body)
      expect(status).toBe(400)
      expect(data).toEqual({ error: 'Unknown transition' })
      expect(mockPerform).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
      expect(revalidateTag).not.toHaveBeenCalled()
    })

    it('answers 400 for a body that is not JSON', async () => {
      const { status } = await post(undefined, true)
      expect(status).toBe(400)
      expect(mockPerform).not.toHaveBeenCalled()
    })
  })

  function expectRevalidated() {
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([
      '/',
      '/events',
      `/event/${EVENT_ID}`,
      `/results/${EVENT_ID}`,
    ])
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith('nav-events', 'fiveMinutes')
  }

  describe('success', () => {
    beforeEach(() => {
      mockPerform.mockResolvedValue({ ok: true, state })
    })

    it('answers 200 with the new state', async () => {
      const { status, body } = await post({ transition: 'lock-results' })
      expect(status).toBe(200)
      expect(body).toEqual({ state })
    })

    it('passes the event, transition, acknowledged warnings and the admin email', async () => {
      await post({
        transition: 'close-voting',
        acknowledgedWarnings: ['No crowd votes have been cast yet.'],
      })
      expect(mockPerform).toHaveBeenCalledWith(
        EVENT_ID,
        {
          transition: 'close-voting',
          acknowledgedWarnings: ['No crowd votes have been cast yet.'],
        },
        'admin@example.com'
      )
    })

    it('drops acknowledged warnings that are not strings', async () => {
      await post({
        transition: 'close-voting',
        acknowledgedWarnings: ['ok', 5, null, { text: 'x' }],
      })
      expect(mockPerform.mock.calls[0][1].acknowledgedWarnings).toEqual(['ok'])
    })

    it('treats a non-list of warnings as none acknowledged', async () => {
      await post({
        transition: 'close-voting',
        acknowledgedWarnings: 'No crowd votes have been cast yet.',
      })
      expect(mockPerform.mock.calls[0][1].acknowledgedWarnings).toEqual([])
    })

    it('falls back to the admin name, then to no actor', async () => {
      auth.session = adminSession({ email: undefined, name: 'Dean' })
      await post({ transition: 'open-voting' })
      expect(mockPerform.mock.calls[0][2]).toBe('Dean')

      auth.session = null
      await post({ transition: 'open-voting' })
      expect(mockPerform.mock.calls[1][2]).toBeNull()
    })

    it('revalidates the public pages and the nav on success', async () => {
      await post({ transition: 'release-results' })
      expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([
        '/',
        '/events',
        `/event/${EVENT_ID}`,
        `/results/${EVENT_ID}`,
      ])
      expect(revalidateTag).toHaveBeenCalledTimes(1)
      expect(revalidateTag).toHaveBeenCalledWith('nav-events', 'fiveMinutes')
    })
  })

  describe('refusals', () => {
    it.each<[string, TransitionResult]>([
      [
        'stale',
        {
          ok: false,
          httpStatus: 409,
          code: 'stale',
          error: 'This event is now "Voting closed"',
          state,
        },
      ],
      [
        'blocked',
        {
          ok: false,
          httpStatus: 422,
          code: 'blocked',
          error: 'No judge scores have been entered.',
          blockers: ['No judge scores have been entered.'],
          state,
        },
      ],
      [
        'needs-confirmation',
        {
          ok: false,
          httpStatus: 409,
          code: 'needs-confirmation',
          error: 'Something changed since you last looked.',
          warnings: ['Only 2 judges have been entered.'],
          state,
        },
      ],
      [
        'not-found',
        {
          ok: false,
          httpStatus: 404,
          code: 'not-found',
          error: 'Event not found',
        },
      ],
    ])(
      'passes a %s refusal through with its status and does not revalidate',
      async (_code, result) => {
        mockPerform.mockResolvedValue(result)
        const { status, body } = await post({ transition: 'lock-results' })
        if (result.ok) throw new Error('fixture must be a refusal')
        expect(status).toBe(result.httpStatus)
        expect(body).toEqual({
          error: result.error,
          code: result.code,
          blockers: result.blockers,
          warnings: result.warnings,
          state: result.state,
        })
        expect(revalidatePath).not.toHaveBeenCalled()
        expect(revalidateTag).not.toHaveBeenCalled()
      }
    )

    it('passes a failed step through and still revalidates (the status may have moved and back)', async () => {
      const result: TransitionResult = {
        ok: false,
        httpStatus: 500,
        code: 'failed',
        error: 'The results could not be saved',
        state,
      }
      mockPerform.mockResolvedValue(result)
      const { status, body } = await post({ transition: 'lock-results' })
      expect(status).toBe(500)
      expect(body).toEqual({
        error: result.error,
        code: 'failed',
        state,
      })
      expectRevalidated()
    })

    it('answers 500 and revalidates when the transition throws', async () => {
      mockPerform.mockRejectedValue(new Error('database down'))
      const { status, body } = await post({ transition: 'lock-results' })
      expect(status).toBe(500)
      expect(body.error).toContain('Refresh to see what state the event is in')
      expectRevalidated()
    })

    it('still answers 500 when revalidating after a throw also fails', async () => {
      mockPerform.mockRejectedValue(new Error('database down'))
      vi.mocked(revalidatePath).mockImplementation(() => {
        throw new Error('cache down')
      })
      const { status } = await post({ transition: 'lock-results' })
      expect(status).toBe(500)
    })
  })
})
