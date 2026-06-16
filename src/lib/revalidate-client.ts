/**
 * Trigger on-demand cache revalidation on the deployed app from a CLI script.
 *
 * CLI scripts run outside the Next.js runtime, so they can't call
 * `revalidatePath`/`revalidateTag` directly — those only affect the cache of
 * the process they run in. Instead we POST to the app's `/api/admin/revalidate`
 * endpoint (which does have the Next runtime) using a bearer secret.
 *
 * This is best-effort: if the secret isn't configured or the request fails we
 * warn and return, never throwing — a successful DB mutation should not be
 * reported as failed just because the cache couldn't be flushed.
 *
 * Config (from the script's environment, e.g. .env.local):
 *  - REVALIDATE_SECRET (or AUTH_SECRET) — must match the deployed app's value.
 *  - REVALIDATE_URL — target base URL; defaults to the production site.
 *    (NEXT_PUBLIC_BASE_URL is intentionally NOT used — it's localhost locally.)
 */
const DEFAULT_TARGET = 'https://www.battleofthetechbands.com'

export async function triggerRevalidate(opts: {
  paths?: string[]
  tags?: string[]
}): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET || process.env.AUTH_SECRET
  const baseUrl = (process.env.REVALIDATE_URL || DEFAULT_TARGET).replace(
    /\/$/,
    ''
  )

  if (!secret) {
    console.warn(
      '⚠️  Skipping cache revalidation: set REVALIDATE_SECRET or AUTH_SECRET to enable.'
    )
    return
  }

  const summary = [...(opts.paths ?? []), ...(opts.tags ?? [])].join(', ')

  try {
    const res = await fetch(`${baseUrl}/api/admin/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ paths: opts.paths ?? [], tags: opts.tags ?? [] }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(
        `⚠️  Revalidation request failed (${res.status}) — mutation still succeeded. ${text.slice(0, 200)}`
      )
      return
    }

    console.log(`♻️  Revalidated ${baseUrl}: ${summary}`)
  } catch (err) {
    console.warn(
      '⚠️  Revalidation request errored — mutation still succeeded:',
      err instanceof Error ? err.message : err
    )
  }
}
