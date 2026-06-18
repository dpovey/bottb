import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import type { MerchOrder } from '@/lib/db-types'

vi.mock('@/lib/env', () => ({
  env: { server: { STRIPE_WEBHOOK_SECRET: 'whsec_test' } },
}))

const constructEvent = vi.fn()
const retrieve = vi.fn()
vi.mock('@/lib/shop/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    checkout: { sessions: { retrieve } },
  }),
}))

const insertMerchOrderIfNew = vi.fn()
const markFulfillmentEmailed = vi.fn()
const markInvoiceEmailed = vi.fn()
vi.mock('@/lib/db', () => ({
  insertMerchOrderIfNew: (...a: unknown[]) => insertMerchOrderIfNew(...a),
  markFulfillmentEmailed: (...a: unknown[]) => markFulfillmentEmailed(...a),
  markInvoiceEmailed: (...a: unknown[]) => markInvoiceEmailed(...a),
}))

const sendEmail = vi.fn()
vi.mock('@/lib/email/resend', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}))

import { POST } from '../route'

const ORDER: MerchOrder = {
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  stripe_session_id: 'cs_test_1',
  stripe_payment_intent_id: 'pi_1',
  product: 'tshirt-2026',
  size: 'L',
  quantity: 2,
  amount_subtotal: 7000,
  amount_shipping: 500,
  amount_total: 7500,
  currency: 'aud',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  customer_phone: null,
  shipping_address: {
    line1: '1 Test St',
    line2: null,
    city: 'Brisbane',
    state: 'QLD',
    postal_code: '4000',
    country: 'AU',
  },
  status: 'paid',
  fulfillment_emailed_at: null,
  invoice_emailed_at: null,
  fulfilled_at: null,
  created_at: '2026-06-18T00:00:00Z',
}

const PAID_SESSION = {
  id: 'cs_test_1',
  payment_status: 'paid',
  payment_intent: 'pi_1',
  metadata: { product: 'tshirt-2026', size: 'L', quantity: '2' },
  amount_subtotal: 7000,
  amount_total: 7500,
  currency: 'aud',
  shipping_cost: { amount_total: 500 },
  customer_details: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: null,
  },
  collected_information: {
    shipping_details: {
      name: 'Jane Doe',
      address: {
        line1: '1 Test St',
        line2: null,
        city: 'Brisbane',
        state: 'QLD',
        postal_code: '4000',
        country: 'AU',
      },
    },
  },
}

function req(signature: string | null, body = '{}'): NextRequest {
  return {
    headers: {
      get: (k: string) => (k === 'stripe-signature' ? signature : null),
    },
    text: async () => body,
  } as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  insertMerchOrderIfNew.mockResolvedValue({ order: ORDER, isNew: true })
  sendEmail.mockResolvedValue({ sent: true, id: 'em_1' })
})

describe('POST /api/webhooks/stripe', () => {
  it('rejects a request with no signature', async () => {
    const res = await POST(req(null))
    expect(res.status).toBe(400)
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('rejects an invalid signature', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('bad sig')
    })
    const res = await POST(req('sig'))
    expect(res.status).toBe(400)
    expect(insertMerchOrderIfNew).not.toHaveBeenCalled()
  })

  it('records the order and sends both emails on checkout.session.completed', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1' } },
    })
    retrieve.mockResolvedValue(PAID_SESSION)

    const res = await POST(req('sig'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })

    const orderArg = insertMerchOrderIfNew.mock.calls[0][0]
    expect(orderArg).toMatchObject({
      stripe_session_id: 'cs_test_1',
      size: 'L',
      quantity: 2,
      amount_total: 7500,
      amount_shipping: 500,
      customer_email: 'jane@example.com',
    })
    expect(orderArg.shipping_address.city).toBe('Brisbane')

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(markFulfillmentEmailed).toHaveBeenCalledWith(ORDER.id)
    expect(markInvoiceEmailed).toHaveBeenCalledWith(ORDER.id)
  })

  it('does not re-send an email already marked sent', async () => {
    insertMerchOrderIfNew.mockResolvedValue({
      order: { ...ORDER, fulfillment_emailed_at: '2026-06-18T01:00:00Z' },
      isNew: false,
    })
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1' } },
    })
    retrieve.mockResolvedValue(PAID_SESSION)

    await POST(req('sig'))
    // Only the invoice email (fulfillment already sent).
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(markFulfillmentEmailed).not.toHaveBeenCalled()
  })

  it('ignores an unpaid session', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1' } },
    })
    retrieve.mockResolvedValue({ ...PAID_SESSION, payment_status: 'unpaid' })

    const res = await POST(req('sig'))
    expect(res.status).toBe(200)
    expect(insertMerchOrderIfNew).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('acknowledges unhandled event types without processing', async () => {
    constructEvent.mockReturnValue({
      type: 'payment_intent.created',
      data: { object: {} },
    })
    const res = await POST(req('sig'))
    expect(res.status).toBe(200)
    expect(retrieve).not.toHaveBeenCalled()
    expect(insertMerchOrderIfNew).not.toHaveBeenCalled()
  })
})
