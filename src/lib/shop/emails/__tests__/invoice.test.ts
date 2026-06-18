import { describe, it, expect } from 'vitest'
import { renderInvoiceEmail } from '../invoice'
import type { MerchOrder } from '@/lib/db-types'

const order: MerchOrder = {
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

describe('renderInvoiceEmail', () => {
  it('is titled "Invoice", never "Tax Invoice"', () => {
    const { html, subject } = renderInvoiceEmail(order)
    expect(html).toContain('>Invoice</h1>')
    expect(html).not.toMatch(/tax invoice/i)
    expect(subject).toContain('Invoice')
  })

  it('shows the seller ABN and states no GST was charged', () => {
    const { html } = renderInvoiceEmail(order)
    expect(html).toContain('BOTB Events Ltd')
    expect(html).toContain('ABN 19 691 201 153')
    expect(html).toContain('not registered for GST')
  })

  it('totals subtotal + shipping = total', () => {
    const { html } = renderInvoiceEmail(order)
    expect(html).toContain('$70.00') // subtotal (2 × $35)
    expect(html).toContain('$5.00') // shipping
    expect(html).toContain('$75.00') // total
    expect(html).toContain('$35.00') // unit price
  })

  it('escapes user-supplied fields to prevent HTML injection', () => {
    const evil = { ...order, customer_name: '<script>alert(1)</script>' }
    const { html } = renderInvoiceEmail(evil)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
