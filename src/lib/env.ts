/**
 * Environment variable validation and access.
 *
 * This module provides type-safe access to environment variables with runtime validation.
 * Variables are validated on first access, with helpful error messages for missing values.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   const dbUrl = env.POSTGRES_URL // Type-safe, validated
 */

interface EnvVarConfig {
  required?: boolean
  default?: string
}

class EnvValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvValidationError'
  }
}

/**
 * Get and validate an environment variable.
 * Throws if required variable is missing.
 */
function getEnvVar(name: string, config: EnvVarConfig = {}): string {
  const value = process.env[name]

  if (value === undefined || value === '') {
    if (config.default !== undefined) {
      return config.default
    }
    if (config.required !== false) {
      throw new EnvValidationError(
        `Missing required environment variable: ${name}. ` +
          `Please add it to your .env.local file or deployment environment.`
      )
    }
    return ''
  }

  return value
}

/**
 * Get an optional environment variable with a default value.
 */
function getOptionalEnvVar(name: string, defaultValue: string = ''): string {
  return process.env[name] ?? defaultValue
}

/**
 * Validate that a URL-like env var is actually a valid URL.
 */
function validateUrl(name: string, value: string): string {
  try {
    new URL(value)
    return value
  } catch {
    throw new EnvValidationError(
      `Environment variable ${name} must be a valid URL, got: ${value}`
    )
  }
}

// ============================================================================
// Server-side environment variables (only available on server)
// ============================================================================

interface ServerEnv {
  // Database
  readonly POSTGRES_URL: string

  // Authentication
  readonly AUTH_SECRET: string

  // Blob storage
  readonly BLOB_READ_WRITE_TOKEN: string

  // Social - LinkedIn
  readonly LINKEDIN_CLIENT_ID: string
  readonly LINKEDIN_CLIENT_SECRET: string

  // Social - Meta (Facebook/Instagram)
  readonly META_APP_ID: string
  readonly META_APP_SECRET: string

  // Social - Encryption
  readonly SOCIAL_TOKEN_SECRET: string

  // OpenAI (for AI caption generation)
  readonly OPENAI_API_KEY: string

  // PostHog
  readonly POSTHOG_PERSONAL_API_KEY: string
  readonly POSTHOG_ENV_ID: string
}

interface OptionalServerEnv {
  // Base URL (auto-detected on Vercel, needed locally)
  readonly NEXT_PUBLIC_BASE_URL: string
}

// Lazy-loaded server environment - only validates when accessed
let _serverEnv: ServerEnv | null = null

function getServerEnv(): ServerEnv {
  if (_serverEnv !== null) return _serverEnv

  // Only validate on server
  if (typeof window !== 'undefined') {
    throw new EnvValidationError(
      'Server environment variables cannot be accessed on the client. ' +
        'Use env.client for client-safe variables.'
    )
  }

  _serverEnv = {
    // Database
    POSTGRES_URL: validateUrl('POSTGRES_URL', getEnvVar('POSTGRES_URL')),

    // Authentication
    AUTH_SECRET: getEnvVar('AUTH_SECRET'),

    // Blob storage
    BLOB_READ_WRITE_TOKEN: getEnvVar('BLOB_READ_WRITE_TOKEN'),

    // Social - LinkedIn
    LINKEDIN_CLIENT_ID: getEnvVar('LINKEDIN_CLIENT_ID', { required: false }),
    LINKEDIN_CLIENT_SECRET: getEnvVar('LINKEDIN_CLIENT_SECRET', {
      required: false,
    }),

    // Social - Meta
    META_APP_ID: getEnvVar('META_APP_ID', { required: false }),
    META_APP_SECRET: getEnvVar('META_APP_SECRET', { required: false }),

    // Social - Encryption
    SOCIAL_TOKEN_SECRET: getEnvVar('SOCIAL_TOKEN_SECRET', { required: false }),

    // OpenAI
    OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY', { required: false }),

    // PostHog
    POSTHOG_PERSONAL_API_KEY: getEnvVar('POSTHOG_PERSONAL_API_KEY', {
      required: false,
    }),
    POSTHOG_ENV_ID: getEnvVar('POSTHOG_ENV_ID', { required: false }),
  }

  return _serverEnv
}

// ============================================================================
// Client-side environment variables (available on both client and server)
// ============================================================================

interface ClientEnv {
  // PostHog analytics
  readonly NEXT_PUBLIC_POSTHOG_KEY: string
  readonly NEXT_PUBLIC_POSTHOG_HOST: string

  // Feature flags
  readonly NEXT_PUBLIC_DISABLE_DEV_TRACKING: boolean

  // Base URL
  readonly NEXT_PUBLIC_BASE_URL: string
}

let _clientEnv: ClientEnv | null = null

function getClientEnv(): ClientEnv {
  if (_clientEnv !== null) return _clientEnv

  _clientEnv = {
    NEXT_PUBLIC_POSTHOG_KEY: getOptionalEnvVar('NEXT_PUBLIC_POSTHOG_KEY'),
    NEXT_PUBLIC_POSTHOG_HOST: getOptionalEnvVar(
      'NEXT_PUBLIC_POSTHOG_HOST',
      'https://us.i.posthog.com'
    ),
    NEXT_PUBLIC_DISABLE_DEV_TRACKING:
      getOptionalEnvVar('NEXT_PUBLIC_DISABLE_DEV_TRACKING') === 'true',
    NEXT_PUBLIC_BASE_URL: getOptionalEnvVar(
      'NEXT_PUBLIC_BASE_URL',
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3030'
    ),
  }

  return _clientEnv
}

// ============================================================================
// Exported environment object
// ============================================================================

/**
 * Type-safe environment variable access.
 *
 * - `env.server` - Server-only variables (database, secrets, etc.)
 * - `env.client` - Client-safe variables (public keys, feature flags)
 *
 * Variables are validated on first access.
 */
export const env = {
  /** Server-only environment variables. Will throw if accessed on client. */
  get server(): ServerEnv & OptionalServerEnv {
    return {
      ...getServerEnv(),
      NEXT_PUBLIC_BASE_URL: getOptionalEnvVar(
        'NEXT_PUBLIC_BASE_URL',
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'
      ),
    }
  },

  /** Client-safe environment variables. Available on both client and server. */
  get client(): ClientEnv {
    return getClientEnv()
  },
}

// ============================================================================
// Validation helpers for use in other modules
// ============================================================================

/**
 * Check if an environment variable is set (useful for conditional features).
 */
export function hasEnvVar(name: string): boolean {
  const value = process.env[name]
  return value !== undefined && value !== ''
}

/**
 * Check if all required social integration env vars are set.
 */
export function hasSocialIntegration(platform: 'linkedin' | 'meta'): boolean {
  if (platform === 'linkedin') {
    return (
      hasEnvVar('LINKEDIN_CLIENT_ID') && hasEnvVar('LINKEDIN_CLIENT_SECRET')
    )
  }
  if (platform === 'meta') {
    return hasEnvVar('META_APP_ID') && hasEnvVar('META_APP_SECRET')
  }
  return false
}
