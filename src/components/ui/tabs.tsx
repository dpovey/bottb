'use client'

import { useState, useId, ReactNode, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export interface Tab {
  id: string
  label: string
  count?: number
}

export interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
  'aria-label'?: string
}

/**
 * Accessible Tabs component following WAI-ARIA Tabs pattern.
 * Uses outline style matching the design system.
 */
export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  'aria-label': ariaLabel = 'Content tabs',
}: TabsProps) {
  const baseId = useId()

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)

    let newIndex = currentIndex
    switch (e.key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        break
      case 'ArrowRight':
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        break
      case 'Home':
        newIndex = 0
        break
      case 'End':
        newIndex = tabs.length - 1
        break
      default:
        return
    }

    e.preventDefault()
    onTabChange(tabs[newIndex].id)
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn('flex gap-1 p-1 bg-white/5 rounded-lg w-fit', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              isActive
                ? 'bg-white text-bg'
                : 'text-text-muted hover:text-white hover:bg-white/10'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-2 text-xs',
                  isActive ? 'text-bg/70' : 'text-text-dim'
                )}
              >
                ({tab.count})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProps {
  tabId: string
  activeTab: string
  children: ReactNode
  className?: string
}

/**
 * Tab panel wrapper for accessible tab content.
 */
export function TabPanel({
  tabId,
  activeTab,
  children,
  className,
}: TabPanelProps) {
  const baseId = useId()
  const isActive = tabId === activeTab

  if (!isActive) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${tabId}`}
      aria-labelledby={`${baseId}-tab-${tabId}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * Hook for managing tab state
 */
export function useTabs(defaultTab: string) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  return { activeTab, setActiveTab }
}
