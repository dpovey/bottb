import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/seo', () => ({ getBaseUrl: () => 'https://test.local' }))
vi.mock('@/lib/env', () => ({
  env: { server: { STRIPE_TSHIRT_PRICE_ID: 'price_test' } },
}))
vi.mock('@/lib/shop/stripe', () => ({ getStripe: vi.fn() }))

import { POST } from '../checkout/route'
import { getStripe } from '@/lib/shop/stripe'
import { env } from '@/lib/env'

// The real `env.server` fields are readonly; the mock is a plain object, so we
// cast to a mutable shape to vary configuration per test.
const mutableEnv = env as unknown as {
  server: { STRIPE_TSHIRT_PRICE_ID: string }
}

const create = vi.fn()

function mockRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  create.mockReset()
  create.mockResolvedValue({ url: 'https://stripe.test/checkout/abc' })
  vi.mocked(getStripe).mockReturnValue({
    checkout: { sessions: { create } },
  } as unknown as ReturnType<typeof getStripe>)
  mutableEnv.server.STRIPE_TSHIRT_PRICE_ID = 'price_test'
})

describe('POST /api/shop/checkout', () => {
  it('creates a checkout session and returns its url', async () => {
    const res = await POST(mockRequest({ size: 'M', quantity: 2 }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      url: 'https://stripe.test/checkout/abc',
    })

    const params = create.mock.calls[0][0]
    expect(params.line_items).toEqual([{ price: 'price_test', quantity: 2 }])
    expect(params.shipping_address_collection.allowed_countries).toEqual(['AU'])
    expect(params.metadata).toMatchObject({ size: 'M', quantity: '2' })
    expect(params.success_url).toContain('/shop/success')
  })

  it('rejects an invalid size', async () => {
    const res = await POST(mockRequest({ size: 'XS', quantity: 1 }))
    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it.each([0, 11, 1.5, 'two'])('rejects invalid quantity %s', async (qty) => {
    const res = await POST(mockRequest({ size: 'M', quantity: qty }))
    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns 500 when the price id is not configured', async () => {
    mutableEnv.server.STRIPE_TSHIRT_PRICE_ID = ''
    const res = await POST(mockRequest({ size: 'M', quantity: 1 }))
    expect(res.status).toBe(500)
    expect(create).not.toHaveBeenCalled()
  })
})
