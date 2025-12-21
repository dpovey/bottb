import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminLayout } from '@/components/layouts'
import { SocialAccountsClient } from './social-accounts-client'
import {
  getSocialAccounts,
  getSocialPostTemplates,
  getRecentSocialPosts,
} from '@/lib/social/db'

export default async function SocialAccountsPage() {
  const session = await auth()

  if (!session?.user?.isAdmin) {
    redirect('/admin/login')
  }

  // Fetch data server-side
  const [accounts, templates, recentPosts] = await Promise.all([
    getSocialAccounts(),
    getSocialPostTemplates(),
    getRecentSocialPosts(10),
  ])

  return (
    <AdminLayout
      title="Social Accounts"
      subtitle="Connect and manage social media accounts"
      breadcrumbs={[
        { label: 'Settings', href: '/admin' },
        { label: 'Social Accounts' },
      ]}
    >
      <SocialAccountsClient
        initialAccounts={accounts}
        initialTemplates={templates}
        initialRecentPosts={recentPosts}
      />
    </AdminLayout>
  )
}
