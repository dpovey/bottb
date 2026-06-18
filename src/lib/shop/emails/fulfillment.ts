import type { MerchOrder } from '@/lib/db-types'
import { formatAUD } from '@/lib/currency'
import { TSHIRT } from '@/lib/shop/config'
import {
  addressLines,
  effectiveItems,
  escapeHtml,
  formatItemsSummary,
  formatOrderDate,
  orderReference,
} from './format'

/**
 * Internal fulfillment notification sent to info@bottb.com so someone can post
 * the shirt. Contains everything needed to pack and ship.
 */
export function renderFulfillmentEmail(order: MerchOrder): {
  subject: string
  html: string
} {
  const ref = orderReference(order)
  const items = effectiveItems(order)
  const subject = `New order ${ref} — ${order.quantity}× ${TSHIRT.name}`

  const address = addressLines(order.shipping_address)
  const addressHtml = address.length
    ? address.join('<br/>')
    : '<em>No shipping address captured</em>'

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#666;">${label}</td><td style="padding:4px 0;"><strong>${value}</strong></td></tr>`

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#111;">
    <h2 style="margin:0 0 4px;">New merch order</h2>
    <p style="margin:0 0 16px;color:#666;">${ref} · ${formatOrderDate(order.created_at)}</p>
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      ${row('Product', escapeHtml(TSHIRT.name))}
      ${row('Sizes', formatItemsSummary(items))}
      ${row('Quantity', String(order.quantity))}
      ${row('Total paid', `${formatAUD(order.amount_total)} (incl. ${formatAUD(order.amount_shipping)} shipping)`)}
    </table>
    <h3 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666;">Ship to</h3>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
      ${order.customer_name ? `<strong>${escapeHtml(order.customer_name)}</strong><br/>` : ''}
      ${addressHtml}
    </p>
    <h3 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666;">Contact</h3>
    <p style="margin:0;font-size:14px;line-height:1.5;">
      ${order.customer_email ? `${escapeHtml(order.customer_email)}<br/>` : ''}
      ${order.customer_phone ? escapeHtml(order.customer_phone) : ''}
    </p>
  </div>`.trim()

  return { subject, html }
}
