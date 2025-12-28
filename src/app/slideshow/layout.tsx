import type { ReactNode } from 'react'

interface SlideshowLayoutProps {
  children: ReactNode
}

/**
 * Minimal layout for slideshow - no header/footer, dark background
 * Uses browser history for back navigation
 */
export default function SlideshowLayout({ children }: SlideshowLayoutProps) {
  return <div className="min-h-screen bg-bg">{children}</div>
}
