import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronRightIcon } from '@/components/icons'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center justify-end gap-1.5 text-sm',
        className
      )}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <span key={index} className="flex items-center gap-1.5">
            {/* Separator (except for first item) */}
            {index > 0 && (
              <ChevronRightIcon
                size={12}
                className="text-text-dim shrink-0"
                strokeWidth={2}
              />
            )}

            {/* Breadcrumb item */}
            {isLast || !item.href ? (
              <span
                className={cn(
                  'truncate max-w-[120px] lg:max-w-[180px]',
                  isLast ? 'text-white' : 'text-text-dim'
                )}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-text-dim hover:text-text-muted transition-colors truncate max-w-[120px] lg:max-w-[180px] py-3 -my-3"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
