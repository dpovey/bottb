/**
 * Thin transactional-email wrapper over Resend.
 *
 * Degrades gracefully: when `RESEND_API_KEY` isn't configured, `sendEmail`
 * logs and returns `{ sent: false }` instead of throwing, so the shop keeps
 * working (orders still record) before email is set up.
 */

import { Resend } from 'resend'
import { env } from '@/lib/env'

/** Fallback sender if `SHOP_EMAIL_FROM` isn't set. Must be on a verified domain. */
const DEFAULT_FROM = 'BOTB Events <orders@bottb.com>'

let _resend: Resend | null = null

function getResend(): Resend | null {
  const apiKey = env.server.RESEND_API_KEY
  if (!apiKey) return null
  if (!_resend) _resend = new Resend(apiKey)
  return _resend
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export interface SendEmailResult {
  sent: boolean
  id?: string
  error?: string
}

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const resend = getResend()
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping "${input.subject}" to ${String(
        input.to
      )}`
    )
    return { sent: false, error: 'not_configured' }
  }

  const from = env.server.SHOP_EMAIL_FROM || DEFAULT_FROM
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
  })

  if (error) {
    console.error('[email] send failed:', error)
    return { sent: false, error: error.message }
  }
  return { sent: true, id: data?.id }
}
