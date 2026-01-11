'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to manage search dialog state with keyboard shortcut support.
 * Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 */
export function useSearch() {
  const [isOpen, setIsOpen] = useState(false)

  function open() {
    setIsOpen(true)
  }
  function close() {
    setIsOpen(false)
  }
  function toggle() {
    setIsOpen((prev) => !prev)
  }

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}
