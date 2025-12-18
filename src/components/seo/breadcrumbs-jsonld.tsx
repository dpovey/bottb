import { getBaseUrl } from "@/lib/seo";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface BreadcrumbsJsonLdProps {
  breadcrumbs: Breadcrumb[];
}

export function BreadcrumbsJsonLd({ breadcrumbs }: BreadcrumbsJsonLdProps) {
  const baseUrl = getBaseUrl();

  const items = breadcrumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.label,
    ...(crumb.href && {
      item: `${baseUrl}${crumb.href}`,
    }),
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

