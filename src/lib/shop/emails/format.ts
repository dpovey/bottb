import type {
  MerchOrder,
  MerchOrderItem,
  MerchShippingAddress,
} from '@/lib/db-types'

/** Escape user-supplied values before interpolating into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Human-friendly invoice/order reference derived from the order id. */
export function orderReference(order: Pick<MerchOrder, 'id'>): string {
  return `BOTB-${order.id.slice(0, 8).toUpperCase()}`
}

/**
 * Per-size line items for an order. Uses the structured `items`, falling back
 * to the legacy single `size`/`quantity` for older orders predating multi-size.
 */
export function effectiveItems(
  order: Pick<MerchOrder, 'items' | 'size' | 'quantity'>
): MerchOrderItem[] {
  if (order.items?.length) return order.items
  if (order.size) return [{ size: order.size, quantity: order.quantity }]
  // No structured items and no single size (shouldn't happen for new orders) —
  // synthesise a line so the email body is never blank.
  if (order.quantity > 0) return [{ size: 'Unknown', quantity: order.quantity }]
  return []
}

/** "1 × M, 2 × L" — sizes HTML-escaped for safety. */
export function formatItemsSummary(items: readonly MerchOrderItem[]): string {
  return items
    .map((item) => `${item.quantity} × ${escapeHtml(item.size)}`)
    .join(', ')
}

/** Format an ISO timestamp as an Australian date, e.g. "18 June 2026". */
export function formatOrderDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  }).format(date)
}

/** Address as escaped HTML lines, ready to join with <br/>. */
export function addressLines(address: MerchShippingAddress | null): string[] {
  if (!address) return []
  const cityLine = [address.city, address.state, address.postal_code]
    .filter(Boolean)
    .join(' ')
  return [address.line1, address.line2, cityLine, address.country]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map(escapeHtml)
}
