import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { env } from '@/lib/env'
import { getStripe } from '@/lib/shop/stripe'
import type { MerchShippingAddress } from '@/lib/db-types'
import {
  insertMerchOrderIfNew,
  markFulfillmentEmailed,
  markInvoiceEmailed,
} from '@/lib/db'
import { sendEmail } from '@/lib/email/resend'
import { renderFulfillmentEmail } from '@/lib/shop/emails/fulfillment'
import { renderInvoiceEmail } from '@/lib/shop/emails/invoice'
import { FULFILLMENT_EMAIL, TSHIRT } from '@/lib/shop/config'

// Stripe SDK needs the Node runtime (crypto) and the raw request body.
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = env.server.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    console.error('Stripe webhook: missing signature or STRIPE_WEBHOOK_SECRET')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 400 }
    )
  }

  const body = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object)
    }
  } catch (err) {
    // Return 500 so Stripe retries delivery.
    console.error(`Stripe webhook handler error (${event.type}):`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(stub: Stripe.Checkout.Session) {
  // Re-fetch the full session for finalized amounts + collected shipping info.
  const session = await getStripe().checkout.sessions.retrieve(stub.id)
  if (session.payment_status !== 'paid') return

  const metadata = session.metadata ?? {}
  const shipping = extractShipping(session)

  const { order } = await insertMerchOrderIfNew({
    stripe_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    product: metadata.product ?? TSHIRT.id,
    size: metadata.size ?? '',
    quantity: Number(metadata.quantity ?? 1),
    amount_subtotal: session.amount_subtotal ?? 0,
    amount_shipping: session.shipping_cost?.amount_total ?? 0,
    amount_total: session.amount_total ?? 0,
    currency: session.currency ?? 'aud',
    customer_name: session.customer_details?.name ?? shipping.name,
    customer_email: session.customer_details?.email ?? null,
    customer_phone: session.customer_details?.phone ?? null,
    shipping_address: shipping.address,
  })

  // Emails are gated on the per-order timestamps (not on "is this the first
  // delivery") so a retry never double-sends, and an order created while email
  // was unconfigured can still be emailed on a later delivery/replay.
  if (!order.fulfillment_emailed_at) {
    const mail = renderFulfillmentEmail(order)
    const res = await sendEmail({
      to: FULFILLMENT_EMAIL,
      subject: mail.subject,
      html: mail.html,
      replyTo: order.customer_email ?? undefined,
    })
    if (res.sent) await markFulfillmentEmailed(order.id)
  }

  if (order.customer_email && !order.invoice_emailed_at) {
    const mail = renderInvoiceEmail(order)
    const res = await sendEmail({
      to: order.customer_email,
      subject: mail.subject,
      html: mail.html,
      replyTo: FULFILLMENT_EMAIL,
    })
    if (res.sent) await markInvoiceEmailed(order.id)
  }
}

function extractShipping(session: Stripe.Checkout.Session): {
  name: string | null
  address: MerchShippingAddress | null
} {
  const details = session.collected_information?.shipping_details
  const address = details?.address ?? null
  return {
    name: details?.name ?? session.customer_details?.name ?? null,
    address: address
      ? {
          line1: address.line1 ?? null,
          line2: address.line2 ?? null,
          city: address.city ?? null,
          state: address.state ?? null,
          postal_code: address.postal_code ?? null,
          country: address.country ?? null,
        }
      : null,
  }
}
