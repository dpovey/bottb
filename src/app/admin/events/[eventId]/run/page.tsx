import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AdminLayout } from '@/components/layouts'
import { auth } from '@/lib/auth'
import { getNightState } from '@/lib/night'
import { RunTheNight } from './run-the-night'

export const metadata: Metadata = {
  title: 'Run the night | Admin',
  robots: { index: false, follow: false },
}

export default async function RunTheNightPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  // Middleware already guards /admin; checking the session here as well keeps
  // this page rendered per request, so it always starts from the live state.
  const session = await auth()
  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }
  const state = await getNightState(eventId)
  if (!state) {
    notFound()
  }

  return (
    <AdminLayout
      title="Run the night"
      subtitle={state.event.name}
      breadcrumbs={[
        { label: 'Events', href: '/admin/events' },
        { label: state.event.name, href: `/admin/events/${eventId}` },
        { label: 'Run the night' },
      ]}
    >
      <RunTheNight eventId={eventId} initialState={state} />
    </AdminLayout>
  )
}
