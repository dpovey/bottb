/**
 * Type declarations for structured-data-testing-tool
 * @see https://www.npmjs.com/package/structured-data-testing-tool
 */

declare module 'structured-data-testing-tool' {
  interface TestResult {
    passed: TestItem[]
    failed: TestItem[]
    warnings: TestItem[]
    schemas: string[]
    structuredData: unknown
    testGroups: unknown[]
  }

  interface TestItem {
    test?: string
    description?: string
    error?: string
    group?: string
    optional?: boolean
  }

  interface TestOptions {
    /** Presets to use for validation (e.g. Google, Twitter, Facebook) */
    presets?: unknown[]
    /** Schema types to check for */
    schemas?: string[]
  }

  interface ValidationError extends Error {
    type: 'VALIDATION_FAILED'
    res: TestResult
  }

  /**
   * Test a URL, HTML string, or buffer for structured data
   */
  export function structuredDataTest(
    input: string | Buffer,
    options?: TestOptions
  ): Promise<TestResult>
}

declare module 'structured-data-testing-tool/presets' {
  /** Google Rich Results validation preset */
  export const Google: unknown
  /** Twitter Card validation preset */
  export const Twitter: unknown
  /** Facebook Open Graph validation preset */
  export const Facebook: unknown
  /** Social media combined preset */
  export const SocialMedia: unknown
}
