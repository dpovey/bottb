import { PublicLayout } from '@/components/layouts'

export default function VoteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PublicLayout>{children}</PublicLayout>
}
