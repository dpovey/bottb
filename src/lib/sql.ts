/**
 * SQL query wrapper that supports both @vercel/postgres (production)
 * and pg (local testing with Docker Postgres)
 *
 * Uses pg when POSTGRES_URL contains 'localhost', otherwise uses @vercel/postgres
 */

import { sql as vercelSql, QueryResult, QueryResultRow } from '@vercel/postgres'

// Type for template literal tag function
type SqlTaggedTemplate = {
  <T extends QueryResultRow>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<QueryResult<T>>
}

// Check if we're connecting to a local database - checked at RUNTIME, not module load
function isLocalDb(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env.POSTGRES_URL?.includes('localhost') ||
      process.env.POSTGRES_URL?.includes('127.0.0.1')) === true
  )
}

// Lazy-load pg only when needed (server-side only)
let localPool: unknown = null

async function getLocalPool() {
  if (!localPool) {
    // Dynamic import to avoid bundling pg for client
    const { Pool } = await import('pg')
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL
    localPool = new Pool({ connectionString })
  }
  return localPool as import('pg').Pool
}

// Create a tagged template function that works like @vercel/postgres sql
const localSql: SqlTaggedTemplate = async <T extends QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> => {
  const pool = await getLocalPool()

  // Build the query with $1, $2, etc. placeholders
  let query = ''
  strings.forEach((str, i) => {
    query += str
    if (i < values.length) {
      query += `$${i + 1}`
    }
  })

  const result = await pool.query<T>(query, values)
  return result as QueryResult<T>
}

// SQL function that checks environment at runtime
export const sql: SqlTaggedTemplate = async <T extends QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> => {
  if (isLocalDb()) {
    return localSql<T>(strings, ...values)
  }
  // Cast values for vercelSql which expects Primitive[]
  return vercelSql<T>(strings, ...(values as Parameters<typeof vercelSql>[1][]))
}

/**
 * Dynamic query function for building queries programmatically
 * Use this when you need to build query strings dynamically (e.g., partial updates)
 */
export async function sqlQuery<T extends QueryResultRow>(
  queryText: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  if (isLocalDb()) {
    const pool = await getLocalPool()
    const result = await pool.query<T>(queryText, values)
    return result as QueryResult<T>
  }

  // For vercel/postgres, we need to use their db.query method
  const { db } = await import('@vercel/postgres')
  const result = await db.query<T>(queryText, values)
  return result as QueryResult<T>
}

// Re-export for convenience
export { vercelSql }
