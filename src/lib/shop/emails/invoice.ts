import type { MerchOrder } from '@/lib/db-types'
import { formatAUD } from '@/lib/currency'
import { SELLER, SITE_URL, TSHIRT } from '@/lib/shop/config'
import {
  addressLines,
  effectiveItems,
  escapeHtml,
  formatOrderDate,
  orderReference,
} from './format'

/**
 * Customer-facing invoice. BOTB Events Ltd is NOT registered for GST, so this
 * is deliberately titled "Invoice" (never "Tax Invoice") and shows no GST line
 * — only the ABN and a note. See [[project-shop-invoice-entity]].
 */
export function renderInvoiceEmail(order: MerchOrder): {
  subject: string
  html: string
} {
  const ref = orderReference(order)
  const subject = `Your Battle of the Tech Bands order — Invoice ${ref}`

  const items = effectiveItems(order)
  const unitPrice =
    order.quantity > 0
      ? Math.round(order.amount_subtotal / order.quantity)
      : order.amount_subtotal

  const billTo = [
    order.customer_name ? escapeHtml(order.customer_name) : null,
    ...addressLines(order.shipping_address),
  ].filter(Boolean)

  const lineItem = (desc: string, qty: number, unit: number, total: number) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${desc}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatAUD(unit)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatAUD(total)}</td>
    </tr>`

  const totalRow = (label: string, value: string, strong = false) => `
    <tr>
      <td colspan="3" style="padding:6px 0;text-align:right;${strong ? 'font-weight:700;' : 'color:#666;'}">${label}</td>
      <td style="padding:6px 0;text-align:right;${strong ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="vertical-align:top;text-align:left;padding:0;">
          <h1 style="margin:0;font-size:22px;letter-spacing:.02em;">Invoice</h1>
          <p style="margin:4px 0 0;color:#666;font-size:13px;">${ref} · ${formatOrderDate(order.created_at)}</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:1.5;">
            <strong>${escapeHtml(SELLER.name)}</strong><br/>
            ABN ${escapeHtml(SELLER.abn)}<br/>
            <a href="mailto:${escapeHtml(SELLER.contactEmail)}" style="color:#666;">${escapeHtml(SELLER.contactEmail)}</a>
          </p>
        </td>
        <td style="vertical-align:top;text-align:right;padding:0;">
          <a href="${SITE_URL}" style="text-decoration:none;">
            <span style="display:inline-block;background:#000;line-height:0;">
              <img src="${SITE_URL}/images/logos/bottb-dark-square.png" alt="Battle of the Tech Bands" width="64" height="64" style="display:block;border:0;" />
            </span>
          </a>
        </td>
      </tr>
    </table>

    ${
      billTo.length
        ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.5;"><span style="color:#666;text-transform:uppercase;letter-spacing:.05em;font-size:11px;">Billed to</span><br/>${billTo.join('<br/>')}</p>`
        : ''
    }

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">
          <th style="text-align:left;padding:0 0 8px;border-bottom:2px solid #111;">Description</th>
          <th style="text-align:center;padding:0 0 8px;border-bottom:2px solid #111;">Qty</th>
          <th style="text-align:right;padding:0 0 8px;border-bottom:2px solid #111;">Unit</th>
          <th style="text-align:right;padding:0 0 8px;border-bottom:2px solid #111;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map((item) =>
            lineItem(
              `${escapeHtml(TSHIRT.name)} (Size ${escapeHtml(item.size)})`,
              item.quantity,
              unitPrice,
              unitPrice * item.quantity
            )
          )
          .join('')}
      </tbody>
      <tfoot>
        ${totalRow('Subtotal', formatAUD(order.amount_subtotal))}
        ${totalRow('Shipping (Australia)', formatAUD(order.amount_shipping))}
        ${totalRow('Total', formatAUD(order.amount_total), true)}
      </tfoot>
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.5;">
      No GST has been charged. ${escapeHtml(SELLER.name)} is not registered for GST.<br/>
      Thank you for supporting
      <a href="${SITE_URL}" style="color:#111;">Battle of the Tech Bands</a> —
      <a href="${SITE_URL}" style="color:#888;">www.battleofthetechbands.com</a>
    </p>
  </div>`.trim()

  return { subject, html }
}
