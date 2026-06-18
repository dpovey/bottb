/**
 * Currency formatting helpers.
 *
 * Amounts are stored and passed around in the smallest currency unit (cents),
 * matching Stripe's convention, and formatted for display in AUD.
 */

const audFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
})

/** Format an amount given in cents as AUD, e.g. 5000 -> "$50.00". */
export function formatAUD(cents: number): string {
  return audFormatter.format(cents / 100)
}
