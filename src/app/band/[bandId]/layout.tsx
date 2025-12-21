import { WebLayout } from '@/components/layouts'
import { getNavEvents } from '@/lib/nav-data'

export default async function BandLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navEvents = await getNavEvents()
  return <WebLayout navEvents={navEvents}>{children}</WebLayout>
}
