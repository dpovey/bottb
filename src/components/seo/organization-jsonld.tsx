import { getBaseUrl } from '@/lib/seo'
import { getSocialLinks } from '@/lib/social-links'

export function OrganizationJsonLd() {
  const baseUrl = getBaseUrl()
  const socialLinks = getSocialLinks()

  // Extract social media URLs
  const socialProfiles: string[] = []
  socialLinks.forEach((link) => {
    if (link.href) {
      socialProfiles.push(link.href)
    }
  })

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Battle of the Tech Bands',
    alternateName: 'BOTTB',
    url: baseUrl,
    logo: `${baseUrl}/images/logos/bottb-horizontal.png`,
    description:
      "Where technology meets rock 'n' roll. A community charity event supporting Youngcare.",
    ...(socialProfiles.length > 0 && {
      sameAs: socialProfiles,
    }),
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'info@bottb.com',
      contactType: 'General Inquiry',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
