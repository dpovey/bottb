import { getBaseUrl } from '@/lib/seo'

interface Breadcrumb {
  label: string
  href?: string
}

interface BreadcrumbsJsonLdProps {
  breadcrumbs: Breadcrumb[]
  /**
   * Unique identifier for this breadcrumb instance (e.g., page path)
   * Used to prevent hydration mismatches when multiple components render
   */
  id?: string
}

export function BreadcrumbsJsonLd({ breadcrumbs, id }: BreadcrumbsJsonLdProps) {
  const baseUrl = getBaseUrl()

  const items = breadcrumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.label,
    ...(crumb.href && {
      item: `${baseUrl}${crumb.href}`,
    }),
  }))

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }

  // Generate a stable id from breadcrumb labels if not provided
  const scriptId =
    id ||
    `breadcrumbs-${breadcrumbs
      .map((b) => b.label)
      .join('-')
      .toLowerCase()
      .replace(/\s+/g, '-')}`

  return (
    <script
      id={scriptId}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  )
}
