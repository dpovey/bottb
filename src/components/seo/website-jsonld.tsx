import { getBaseUrl } from '@/lib/seo'

/**
 * WebSite entity, the standard companion to the Organization node.
 *
 * It names the site itself and attributes it to the organisation via `@id`,
 * which is what lets a search engine treat "the site" and "the org behind it"
 * as one connected pair rather than two unrelated things that happen to share
 * a domain.
 *
 * No `potentialAction`/SearchAction: site search is a client-side dialog with
 * no URL to hand a query to, and declaring one that does not work is worse
 * than declaring none.
 */
export function WebSiteJsonLd() {
  const baseUrl = getBaseUrl()

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    name: 'Battle of the Tech Bands',
    alternateName: 'BOTTB',
    url: baseUrl,
    inLanguage: 'en-AU',
    publisher: {
      '@id': `${baseUrl}/#organization`,
    },
  }

  return (
    <script
      id="website-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  )
}
