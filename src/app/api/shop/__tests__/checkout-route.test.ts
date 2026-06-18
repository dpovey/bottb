import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/seo', () => ({ getBaseUrl: () => 'https://test.local' }))
vi.mock('@/lib/env', () => ({
  env: { server: { STRIPE_TSHIRT_PRODUCT_ID: 'prod_test' } },
}))
vi.mock('@/lib/shop/stripe', () => ({ getStripe: vi.fn() }))

import { POST } from '../checkout/route'
import { getStripe } from '@/lib/shop/stripe'
import { env } from '@/lib/env'

// The real `env.server` fields are readonly; the mock is a plain object, so we
// cast to a mutable shape to vary configuration per test.
const mutableEnv = env as unknown as {
  server: { STRIPE_TSHIRT_PRODUCT_ID: string }
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
  mutableEnv.server.STRIPE_TSHIRT_PRODUCT_ID = 'prod_test'
})

describe('POST /api/shop/checkout', () => {
  it('charges the single unit price ($40) for one shirt', async () => {
    const res = await POST(mockRequest({ items: [{ size: 'L', quantity: 1 }] }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      url: 'https://stripe.test/checkout/abc',
    })

    const params = create.mock.calls[0][0]
    expect(params.line_items).toEqual([
      {
        price_data: {
          currency: 'aud',
          product: 'prod_test',
          unit_amount: 4000,
        },
        quantity: 1,
      },
    ])
    expect(params.metadata.quantity).toBe('1')
    expect(JSON.parse(params.metadata.items)).toEqual([
      { size: 'L', quantity: 1 },
    ])
  })

  it('applies the bulk price ($35) across mixed sizes totalling 2+', async () => {
    await POST(
      mockRequest({
        items: [
          { size: 'M', quantity: 1 },
          { size: 'L', quantity: 1 },
        ],
      })
    )
    const params = create.mock.calls[0][0]
    // One line item for the whole order at the discounted unit price.
    expect(params.line_items).toEqual([
      {
        price_data: {
          currency: 'aud',
          product: 'prod_test',
          unit_amount: 3500,
        },
        quantity: 2,
      },
    ])
    expect(JSON.parse(params.metadata.items)).toEqual([
      { size: 'M', quantity: 1 },
      { size: 'L', quantity: 1 },
    ])
    expect(params.shipping_address_collection.allowed_countries).toEqual(['AU'])
    expect(params.success_url).toContain('/shop/success')
  })

  it.each([
    { label: 'empty items', body: { items: [] } },
    { label: 'missing items', body: {} },
    { label: 'invalid size', body: { items: [{ size: 'XS', quantity: 1 }] } },
    { label: 'zero total', body: { items: [{ size: 'M', quantity: 0 }] } },
    {
      label: 'over the max',
      body: { items: [{ size: 'M', quantity: 21 }] },
    },
  ])('rejects $label with 400', async ({ body }) => {
    const res = await POST(mockRequest(body))
    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns 500 when the product id is not configured', async () => {
    mutableEnv.server.STRIPE_TSHIRT_PRODUCT_ID = ''
    const res = await POST(mockRequest({ items: [{ size: 'M', quantity: 1 }] }))
    expect(res.status).toBe(500)
    expect(create).not.toHaveBeenCalled()
  })
})
