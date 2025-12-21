'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useMounted } from '@/lib/hooks'
import { trackNavClick } from '@/lib/analytics'
import {
  PhotoIcon,
  PlayCircleIcon,
  CameraIcon,
  ChevronDownIcon,
} from '@/components/icons'

interface ExperienceDropdownProps {
  /** Additional className for the trigger button */
  className?: string
}

const experienceLinks = [
  {
    href: '/photos',
    label: 'Photos',
    description: 'Event photo galleries',
    icon: <PhotoIcon className="w-5 h-5" />,
  },
  {
    href: '/videos',
    label: 'Videos',
    description: 'Performance highlights',
    icon: <PlayCircleIcon className="w-5 h-5" />,
  },
  {
    href: '/photographers',
    label: 'Photographers',
    description: 'Our talented photographers',
    icon: <CameraIcon className="w-5 h-5" />,
  },
]

export function ExperienceDropdown({ className }: ExperienceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const mounted = useMounted()

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        triggerRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleLinkClick = (label: string) => {
    trackNavClick({
      nav_item: label.toLowerCase(),
      nav_section: 'gallery',
      location: 'header',
    })
    setIsOpen(false)
  }

  // Dropdown panel - rendered via portal to avoid nested backdrop-filter issue
  const dropdownPanel = (
    <div
      ref={panelRef}
      id="experience-dropdown-panel"
      role="menu"
      aria-labelledby="experience-dropdown-trigger"
      className={cn(
        'fixed left-0 right-0 z-40',
        'bg-bg/40 backdrop-blur-2xl saturate-150',
        'border-b border-white/8',
        'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]'
      )}
      style={{ top: '64px' }} // Header height
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <div className="grid md:grid-cols-3 gap-4">
          {experienceLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => handleLinkClick(link.label)}
              role="menuitem"
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg',
                'hover:bg-white/5 transition-colors',
                'opacity-0 -translate-y-1 animate-dropdown-item'
              )}
              style={{
                animationDelay: `${index * 30}ms`,
                animationFillMode: 'forwards',
              }}
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-text-muted">
                {link.icon}
              </div>
              <div>
                <div className="text-white font-medium uppercase tracking-widest text-sm">
                  {link.label}
                </div>
                <div className="text-text-muted text-sm">
                  {link.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="experience-dropdown-panel"
        className={cn(
          'flex items-center gap-1.5 text-sm tracking-widest uppercase transition-colors relative cursor-pointer',
          isOpen ? 'text-white' : 'text-text-muted hover:text-white',
          className
        )}
      >
        Gallery
        <ChevronDownIcon className="w-4 h-4 transition-transform duration-300" />
        {/* Accent underline indicator */}
        <span
          className={cn(
            'absolute -bottom-1 left-0 right-0 h-0.5 bg-accent transition-transform duration-300 origin-left',
            isOpen ? 'scale-x-100' : 'scale-x-0'
          )}
        />
      </button>

      {/* Dropdown Panel - rendered via portal outside header to avoid nested backdrop-filter */}
      {mounted && isOpen && createPortal(dropdownPanel, document.body)}
    </>
  )
}
