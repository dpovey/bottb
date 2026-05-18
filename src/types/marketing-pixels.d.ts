// Global types for marketing pixels (Meta + LinkedIn) loaded via inline snippets.

interface LintrkOptions {
  conversion_id?: number
}

interface LintrkQueueItem {
  0: string
  1?: LintrkOptions
}

interface LintrkFn {
  (action: string, options?: LintrkOptions): void
  q?: LintrkQueueItem[]
}

declare global {
  interface Window {
    _linkedin_partner_id?: string
    _linkedin_data_partner_ids?: string[]
    lintrk?: LintrkFn
    // Meta Pixel global (defined by react-facebook-pixel/the FB snippet).
    fbq?: (...args: unknown[]) => void
  }
}

export {}
