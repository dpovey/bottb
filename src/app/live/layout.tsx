import { PublicLayout } from '@/components/layouts'

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PublicLayout>{children}</PublicLayout>
}
