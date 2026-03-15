/**
 * Lightweight inline markdown utilities for event descriptions.
 * Supports: links [text](url), bold **text**, italic *text*
 */

/**
 * Strip markdown syntax and return plain text.
 * Used for SEO metadata, JSON-LD, and search indexing.
 */
export function stripMarkdown(text: string): string {
  if (!text) return ''

  return (
    text
      // Links: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Bold: **text** -> text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // Italic: *text* -> text (but not inside words like don*t)
      .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '$1')
  )
}

interface MarkdownTextProps {
  children: string
  className?: string
}

/**
 * Render inline markdown as React elements.
 * Supports links, bold, and italic.
 */
export function MarkdownText({ children, className }: MarkdownTextProps) {
  if (!children) return null

  const elements: React.ReactNode[] = []
  let key = 0

  // Pattern to match markdown elements in order of precedence
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(children)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      elements.push(children.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // Link: [text](url)
      const isExternal =
        match[2].startsWith('http://') || match[2].startsWith('https://')
      elements.push(
        <a
          key={key++}
          href={match[2]}
          className="text-accent hover:underline"
          {...(isExternal && {
            target: '_blank',
            rel: 'noopener noreferrer',
          })}
        >
          {match[1]}
        </a>
      )
    } else if (match[3] !== undefined) {
      // Bold: **text**
      elements.push(<strong key={key++}>{match[3]}</strong>)
    } else if (match[4] !== undefined) {
      // Italic: *text*
      elements.push(<em key={key++}>{match[4]}</em>)
    }

    lastIndex = pattern.lastIndex
  }

  // Add remaining text after last match
  if (lastIndex < children.length) {
    elements.push(children.slice(lastIndex))
  }

  // If no markdown was found, just return the text
  if (elements.length === 0) {
    elements.push(children)
  }

  return <p className={className}>{elements}</p>
}
