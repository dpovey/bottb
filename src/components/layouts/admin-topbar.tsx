"use client";

import Link from "next/link";
import type { BreadcrumbItem } from "@/components/nav";

interface AdminTopBarProps {
  /** Page title */
  title: string;
  /** Page subtitle/description */
  subtitle?: string;
  /** Breadcrumb trail */
  breadcrumbs?: BreadcrumbItem[];
  /** Optional actions to show on the right side */
  actions?: React.ReactNode;
}

export function AdminTopBar({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-lg border-b border-white/5 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-2 text-sm text-muted mb-1">
              {breadcrumbs.map((crumb, index) => (
                <span key={index} className="flex items-center gap-2">
                  {index > 0 && (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-white transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          {/* Title */}
          <h1 className="font-semibold text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
        {/* Actions */}
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
