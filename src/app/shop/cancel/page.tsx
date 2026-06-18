import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { Button } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Checkout cancelled | Battle of the Tech Bands',
  robots: { index: false, follow: false },
}

export default function ShopCancelPage() {
  return (
    <PublicLayout
      headerVariant="solid"
      footerVariant="simple"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Shop', href: '/shop' },
        { label: 'Cancelled' },
      ]}
    >
      <main className="mx-auto max-w-xl px-6 py-16 text-center lg:py-24">
        <h1 className="text-3xl font-bold sm:text-4xl">Checkout cancelled</h1>
        <p className="mt-4 text-text-muted">
          No charge was made. Your cart wasn&apos;t saved — head back to the
          shop to try again whenever you&apos;re ready.
        </p>
        <div className="mt-10">
          <Link href="/shop">
            <Button variant="accent" size="lg">
              Return to shop
            </Button>
          </Link>
        </div>
      </main>
    </PublicLayout>
  )
}
