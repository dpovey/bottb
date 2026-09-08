import { sql } from '../lib/sql'
import { log } from './output'

/**
 * Which wire the CLI is talking to Postgres over.
 *
 * The runbook's note that "port 5432 is blocked" is misleading and has cost
 * time. @vercel/postgres does not use 5432 at all: it opens a WebSocket to
 * the Neon proxy on 443, which works fine from here. Only raw `pg`, `psql`
 * and `node-pg-migrate` need 5432, which is why migrations are the thing that
 * fails, not the app.
 *
 * So `src/lib/sql.ts` is the primary transport. Raw `pg` is kept as a
 * fallback, but the CLI always prints which one it used - a silent downgrade
 * to a transport that behaves differently is worse than a loud failure.
 */
export type TransportName =
  | 'vercel-postgres (WebSocket, 443)'
  | 'pg (TCP, 5432)'

export interface TransportInfo {
  transport: TransportName
  fallbackUsed: boolean
  /** Milliseconds for the probe query. */
  latencyMs: number
  host: string | null
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

async function probe(): Promise<number> {
  const t0 = Date.now()
  await sql`SELECT 1 AS ok`
  return Date.now() - t0
}

/**
 * Connect, and say how. Throws only if both transports fail.
 */
export async function connect(): Promise<TransportInfo> {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
  const host = hostOf(url)
  const isLocal = !!url && /localhost|127\.0\.0\.1/.test(url)

  if (isLocal) {
    const latencyMs = await probe()
    const info: TransportInfo = {
      transport: 'pg (TCP, 5432)',
      fallbackUsed: false,
      latencyMs,
      host,
    }
    log(`transport: ${info.transport} -> ${host} (${latencyMs}ms)`)
    return info
  }

  try {
    const latencyMs = await probe()
    const info: TransportInfo = {
      transport: 'vercel-postgres (WebSocket, 443)',
      fallbackUsed: false,
      latencyMs,
      host,
    }
    log(`transport: ${info.transport} -> ${host} (${latencyMs}ms)`)
    return info
  } catch (err) {
    log(
      `WARNING: the @vercel/postgres WebSocket transport failed (${
        err instanceof Error ? err.message : String(err)
      }).`
    )
    log(
      'WARNING: falling back to raw pg over TCP/5432. This is a DIFFERENT transport, not a retry.'
    )
    log(
      'WARNING: if 5432 is blocked on this network the fallback will also fail. That is expected.'
    )
    process.env.BOTTB_SQL_FORCE_PG = '1'
    const latencyMs = await probe()
    const info: TransportInfo = {
      transport: 'pg (TCP, 5432)',
      fallbackUsed: true,
      latencyMs,
      host,
    }
    log(`transport: ${info.transport} -> ${host} (${latencyMs}ms) [FALLBACK]`)
    return info
  }
}
