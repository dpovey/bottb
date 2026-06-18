import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { env } from '@/lib/env'
import { getBaseUrl } from '@/lib/seo'
import { getStripe } from '@/lib/shop/stripe'
import {
  parseOrderItems,
  SHIPPING_CENTS,
  SHOP_CURRENCY,
  totalQuantity,
  TSHIRT,
  unitPriceCents,
} from '@/lib/shop/config'

/**
 * Creates a Stripe Checkout Session for the 2026 t-shirt and returns its
 * hosted-checkout URL. The client redirects the browser to that URL.
 *
 * Size + quantity are validated here and echoed into the session metadata so
 * the (upcoming) webhook can read them back for fulfillment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const items = parseOrderItems(body?.items)
    if (!items) {
      return NextResponse.json(
        { error: 'Invalid order — choose at least one shirt' },
        { status: 400 }
      )
    }
    const total = totalQuantity(items)
    const unitAmount = unitPriceCents(total)

    const productId = env.server.STRIPE_TSHIRT_PRODUCT_ID
    if (!productId) {
      console.error('Shop checkout: STRIPE_TSHIRT_PRODUCT_ID is not set')
      return NextResponse.json(
        { error: 'Shop is not configured' },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl()

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      // One line item for the whole order — every shirt is the same product at
      // the same volume-discounted unit price (the discount keys off the total
      // across sizes). The per-size breakdown rides in metadata.items.
      line_items: [
        {
          price_data: {
            currency: SHOP_CURRENCY,
            product: productId,
            unit_amount: unitAmount,
          },
          quantity: total,
        },
      ],
      // Australia-only shipping for now.
      shipping_address_collection: { allowed_countries: ['AU'] },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: SHIPPING_CENTS, currency: SHOP_CURRENCY },
            display_name: 'Standard shipping (Australia)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 10 },
            },
          },
        },
      ],
      custom_text: {
        shipping_address: {
          message: 'We currently ship within Australia only.',
        },
      },
      metadata: {
        product: TSHIRT.id,
        items: JSON.stringify(items),
        quantity: String(total),
      },
      success_url: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shop/cancel`,
    }

    const session = await getStripe().checkout.sessions.create(params)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Shop checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to start checkout' },
      { status: 500 }
    )
  }
}
