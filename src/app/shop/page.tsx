import type { Metadata } from 'next'
import { PublicLayout } from '@/components/layouts'
import { ShopClient } from './shop-client'
import { TSHIRT } from '@/lib/shop/config'

// Hidden / unlisted: not linked in nav, excluded from the sitemap, and marked
// noindex so it isn't crawled while we soft-launch for testing.
export const metadata: Metadata = {
  title: 'Shop | Battle of the Tech Bands',
  description: TSHIRT.description,
  robots: { index: false, follow: false },
}

export default function ShopPage() {
  return (
    <PublicLayout
      headerVariant="solid"
      footerVariant="simple"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Shop' }]}
    >
      <main className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
        <ShopClient />
      </main>
    </PublicLayout>
  )
}
