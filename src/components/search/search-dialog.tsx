'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { create, load, search, type Orama, type Results } from '@orama/orama'
import { cn } from '@/lib/utils'
import { SearchIcon, CloseIcon, SpinnerIcon } from '@/components/icons'

// Search result document type (matches build script)
interface SearchDocument {
  id: string
  title: string
  content: string
  type: 'event' | 'band' | 'song' | 'company' | 'photographer' | 'page'
  url: string
  subtitle?: string
  image?: string
}

// Type icons for different result types
const typeIcons: Record<SearchDocument['type'], string> = {
  event: '📅',
  band: '🎸',
  song: '🎵',
  company: '🏢',
  photographer: '📷',
  page: '📄',
}

const typeLabels: Record<SearchDocument['type'], string> = {
  event: 'Event',
  band: 'Band',
  song: 'Song',
  company: 'Company',
  photographer: 'Photographer',
  page: 'Page',
}

interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Extract a snippet of content around the matched query terms.
 * Returns null if query is in the title (no need to show snippet).
 */
function getMatchSnippet(
  content: string,
  title: string,
  query: string,
  maxLength: number = 80
): string | null {
  const queryLower = query.toLowerCase()
  const titleLower = title.toLowerCase()

  // If query is fully contained in title, no need for snippet
  if (titleLower.includes(queryLower)) {
    return null
  }

  const contentLower = content.toLowerCase()
  const matchIndex = contentLower.indexOf(queryLower)

  if (matchIndex === -1) {
    // Try matching individual words
    const words = query.split(/\s+/).filter((w) => w.length > 2)
    for (const word of words) {
      const wordIndex = contentLower.indexOf(word.toLowerCase())
      if (wordIndex !== -1 && !titleLower.includes(word.toLowerCase())) {
        return extractSnippet(content, wordIndex, word.length, maxLength)
      }
    }
    return null
  }

  return extractSnippet(content, matchIndex, query.length, maxLength)
}

function extractSnippet(
  content: string,
  matchIndex: number,
  matchLength: number,
  maxLength: number
): string {
  const halfContext = Math.floor((maxLength - matchLength) / 2)
  let start = Math.max(0, matchIndex - halfContext)
  let end = Math.min(content.length, matchIndex + matchLength + halfContext)

  // Adjust to word boundaries
  if (start > 0) {
    const spaceIndex = content.indexOf(' ', start)
    if (spaceIndex !== -1 && spaceIndex < matchIndex) {
      start = spaceIndex + 1
    }
  }
  if (end < content.length) {
    const spaceIndex = content.lastIndexOf(' ', end)
    if (spaceIndex > matchIndex + matchLength) {
      end = spaceIndex
    }
  }

  let snippet = content.slice(start, end).trim()
  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet = snippet + '...'

  return snippet
}

// Schema must match build script - defined outside component to avoid dependency issues
const schema = {
  id: 'string',
  title: 'string',
  content: 'string',
  type: 'string',
  url: 'string',
  subtitle: 'string',
  image: 'string',
} as const

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results<SearchDocument> | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [db, setDb] = useState<Orama<typeof schema> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load search index on first open
  useEffect(() => {
    if (!isOpen || db) return

    async function loadIndex() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/search-index.json')
        if (!response.ok) {
          throw new Error('Search index not found')
        }

        const indexData = await response.json()
        const database = create({ schema })
        await load(database, indexData)
        setDb(database)
      } catch (err) {
        console.error('Failed to load search index:', err)
        setError('Search is currently unavailable')
      } finally {
        setIsLoading(false)
      }
    }

    loadIndex()
  }, [isOpen, db])

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure portal is rendered
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults(null)
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Perform search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!db || !searchQuery.trim()) {
        setResults(null)
        return
      }

      const searchResults = await search(db, {
        term: searchQuery,
        limit: 10,
        boost: {
          title: 2,
        },
      })

      setResults(searchResults as Results<SearchDocument>)
      setSelectedIndex(0)
    },
    [db]
  )

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 150)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Navigate to selected result
  const navigateToResult = useCallback(
    (doc: SearchDocument) => {
      router.push(doc.url)
      onClose()
    },
    [router, onClose]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const hits = results?.hits || []

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, hits.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (hits[selectedIndex]) {
            navigateToResult(hits[selectedIndex].document)
          }
          break
        case 'Escape':
          onClose()
          break
      }
    },
    [results, selectedIndex, onClose, navigateToResult]
  )

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      )
      selectedElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Handle escape key globally
  useEffect(() => {
    if (!isOpen) return

    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const hits = results?.hits || []

  const dialogContent = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-2xl bg-bg-elevated rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <SearchIcon className="w-5 h-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search events, bands, songs..."
            className="flex-1 px-2 bg-transparent text-white placeholder:text-text-dim text-base rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label="Search query"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="search"
            enterKeyHint="search"
          />
          {isLoading ? (
            <SpinnerIcon className="w-5 h-5 text-text-muted animate-spin" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-text-muted hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto overscroll-y-contain touch-pan-y"
          role="listbox"
        >
          {error ? (
            <div className="px-5 py-8 text-center text-text-muted">
              <p>{error}</p>
              <p className="text-sm text-text-dim mt-1">
                Try refreshing the page
              </p>
            </div>
          ) : isLoading && !db ? (
            <div className="px-5 py-8 text-center text-text-muted">
              <SpinnerIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>Loading search...</p>
            </div>
          ) : query && hits.length === 0 ? (
            <div className="px-5 py-8 text-center text-text-muted">
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-text-dim mt-1">
                Try different keywords
              </p>
            </div>
          ) : hits.length > 0 ? (
            <ul className="py-2">
              {hits.map((hit, index) => {
                const doc = hit.document
                return (
                  <li key={doc.id}>
                    <button
                      data-index={index}
                      onClick={() => navigateToResult(doc)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full px-5 py-3 flex items-start gap-3 text-left transition-colors',
                        index === selectedIndex
                          ? 'bg-white/10'
                          : 'hover:bg-white/5'
                      )}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      {/* Type icon */}
                      <span className="text-lg shrink-0 mt-0.5">
                        {typeIcons[doc.type]}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {doc.title}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-text-dim shrink-0">
                            {typeLabels[doc.type]}
                          </span>
                        </div>
                        {doc.subtitle && (
                          <p className="text-sm text-text-muted truncate mt-0.5">
                            {doc.subtitle}
                          </p>
                        )}
                        {(() => {
                          const snippet = getMatchSnippet(
                            doc.content,
                            doc.title,
                            query
                          )
                          return snippet ? (
                            <p className="text-xs text-text-dim mt-1 line-clamp-2">
                              {snippet}
                            </p>
                          ) : null
                        })()}
                      </div>

                      {/* Arrow indicator */}
                      {index === selectedIndex && (
                        <span className="text-text-dim text-sm shrink-0">
                          ↵
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-5 py-6 text-center text-text-dim text-sm">
              <p>Start typing to search</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {hits.length > 0 && (
          <div className="px-5 py-2 border-t border-white/5 text-xs text-text-dim">
            <span>{results?.count} results</span>
          </div>
        )}
      </div>
    </div>
  )

  // Render in portal
  if (typeof document !== 'undefined') {
    return createPortal(dialogContent, document.body)
  }

  return dialogContent
}
