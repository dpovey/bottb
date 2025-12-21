import { getNavEvents } from '@/lib/nav-data'
import { Header, type HeaderProps } from './header'

/**
 * Server component wrapper for Header that fetches nav events data
 * with caching for optimal performance and SEO
 */
export async function HeaderServer(props: HeaderProps) {
  const navEvents = await getNavEvents()

  return <Header {...props} navEvents={navEvents} />
}
