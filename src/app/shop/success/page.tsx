import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { Button } from '@/components/ui'
import { getStripe } from '@/lib/shop/stripe'
import { formatAUD } from '@/lib/currency'
import { parseOrderItems, totalQuantity } from '@/lib/shop/config'

export const metadata: Metadata = {
  title: 'Order confirmed | Battle of the Tech Bands',
  robots: { index: false, follow: false },
}

interface OrderSummary {
  reference: string
  email: string | null
  items: string | null
  quantity: number | null
  total: number | null
}

function summarizeItems(raw: string | undefined): {
  summary: string | null
  quantity: number | null
} {
  if (!raw) return { summary: null, quantity: null }
  try {
    const items = parseOrderItems(JSON.parse(raw))
    if (!items) return { summary: null, quantity: null }
    return {
      summary: items.map((i) => `${i.quantity} × ${i.size}`).join(', '),
      quantity: totalQuantity(items),
    }
  } catch {
    return { summary: null, quantity: null }
  }
}

async function loadOrder(sessionId: string): Promise<OrderSummary | null> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid') return null
    const { summary, quantity } = summarizeItems(session.metadata?.items)
    return {
      reference: session.id.replace('cs_', '').slice(0, 12).toUpperCase(),
      email: session.customer_details?.email ?? null,
      items: summary,
      quantity,
      total: session.amount_total,
    }
  } catch {
    return null
  }
}

export default async function ShopSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams
  const order = sessionId ? await loadOrder(sessionId) : null

  return (
    <PublicLayout
      headerVariant="solid"
      footerVariant="simple"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Shop', href: '/shop' },
        { label: 'Confirmed' },
      ]}
    >
      <main className="mx-auto max-w-xl px-6 py-16 text-center lg:py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">
          Thank you
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          Your order is confirmed
        </h1>
        <p className="mt-4 text-text-muted">
          We&apos;ve received your payment. Your 2026 Battle of the Tech Bands
          tee will be posted within Australia shortly.
          {order?.email ? (
            <>
              {' '}
              A receipt has been sent to{' '}
              <span className="text-white">{order.email}</span>.
            </>
          ) : null}
        </p>

        {order && (
          <dl className="mt-10 space-y-3 rounded-2xl border border-white/10 bg-bg-elevated p-6 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Order reference</dt>
              <dd className="font-mono text-white">{order.reference}</dd>
            </div>
            {order.items && (
              <div className="flex justify-between">
                <dt className="text-text-muted">Items</dt>
                <dd className="text-white">{order.items}</dd>
              </div>
            )}
            {order.quantity != null && !order.items && (
              <div className="flex justify-between">
                <dt className="text-text-muted">Quantity</dt>
                <dd className="text-white">{order.quantity}</dd>
              </div>
            )}
            {order.total != null && (
              <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
                <dt>Total paid</dt>
                <dd>{formatAUD(order.total)}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-10">
          <Link href="/shop">
            <Button variant="outline-solid" size="lg">
              Back to shop
            </Button>
          </Link>
        </div>
      </main>
    </PublicLayout>
  )
}
