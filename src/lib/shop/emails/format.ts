import type { MerchOrder, MerchShippingAddress } from '@/lib/db-types'

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
