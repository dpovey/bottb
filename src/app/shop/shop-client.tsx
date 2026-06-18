'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui'
import { formatAUD } from '@/lib/currency'
import {
  MAX_QUANTITY,
  SHIPPING_CENTS,
  TSHIRT,
  TSHIRT_BULK_MIN_QTY,
  TSHIRT_BULK_UNIT_PRICE_CENTS,
  TSHIRT_SIZES,
  unitPriceCents,
  type TShirtSize,
} from '@/lib/shop/config'

const isTestMode = (
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
).startsWith('pk_test')

type Quantities = Record<TShirtSize, number>

const EMPTY_QUANTITIES = Object.fromEntries(
  TSHIRT_SIZES.map((size) => [size, 0])
) as Quantities

export function ShopClient() {
  const [activeImage, setActiveImage] = useState(0)
  const [quantities, setQuantities] = useState<Quantities>(EMPTY_QUANTITIES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalQty = TSHIRT_SIZES.reduce((sum, s) => sum + quantities[s], 0)
  const unit = unitPriceCents(totalQty)
  const subtotal = unit * totalQty
  const orderTotal = totalQty > 0 ? subtotal + SHIPPING_CENTS : 0

  function adjust(size: TShirtSize, delta: number) {
    setError(null)
    setQuantities((prev) => {
      const next = prev[size] + delta
      if (next < 0) return prev
      // Derive the total from `prev` (not the render-scope `totalQty`) so two
      // rapid taps before a re-render can't both pass a stale cap check.
      const prevTotal = TSHIRT_SIZES.reduce((sum, s) => sum + prev[s], 0)
      if (delta > 0 && prevTotal >= MAX_QUANTITY) return prev
      return { ...prev, [size]: next }
    })
  }

  async function handleBuy() {
    const items = TSHIRT_SIZES.filter((s) => quantities[s] > 0).map((s) => ({
      size: s,
      quantity: quantities[s],
    }))
    if (items.length === 0) {
      setError('Add at least one shirt.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout. Please retry.')
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Gallery */}
      <div>
        <div className="relative aspect-[1137/1383] overflow-hidden rounded-2xl border border-white/10 bg-bg-elevated">
          <Image
            src={TSHIRT.images[activeImage].src}
            alt={TSHIRT.images[activeImage].alt}
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-contain"
          />
        </div>
        <div className="mt-4 flex gap-3">
          {TSHIRT.images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              onClick={() => setActiveImage(index)}
              aria-label={`View image ${index + 1}`}
              aria-pressed={activeImage === index}
              className={`relative h-20 w-20 overflow-hidden rounded-lg border bg-bg-elevated transition-colors ${
                activeImage === index
                  ? 'border-accent'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <Image
                src={image.src}
                alt=""
                fill
                sizes="80px"
                className="object-contain"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Details + purchase */}
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-text-dim">
          {TSHIRT.tagline}
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{TSHIRT.name}</h1>
        <p className="mt-4 text-2xl font-semibold text-white">
          {formatAUD(TSHIRT.priceCents)}
          <span className="ml-2 text-sm font-normal text-text-dim">
            + {formatAUD(SHIPPING_CENTS)} shipping (Australia)
          </span>
        </p>
        <p className="mt-1 text-sm text-accent">
          {formatAUD(TSHIRT_BULK_UNIT_PRICE_CENTS)} each when you buy{' '}
          {TSHIRT_BULK_MIN_QTY} or more (mix &amp; match sizes)
        </p>
        <p className="mt-6 leading-relaxed text-text-muted">
          {TSHIRT.description}
        </p>

        {/* Per-size quantities */}
        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-white">
            Choose sizes
          </legend>
          <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
            {TSHIRT_SIZES.map((size) => (
              <div
                key={size}
                className="flex items-center justify-between py-3"
              >
                <span className="font-medium text-white">{size}</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => adjust(size, -1)}
                    disabled={quantities[size] === 0}
                    aria-label={`Remove one ${size}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/5 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span
                    className="w-6 text-center tabular-nums text-white"
                    aria-live="polite"
                  >
                    {quantities[size]}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjust(size, 1)}
                    disabled={totalQty >= MAX_QUANTITY}
                    aria-label={`Add one ${size}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/5 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          {totalQty >= MAX_QUANTITY && (
            <p className="mt-2 text-xs text-text-dim">
              Maximum {MAX_QUANTITY} shirts per order.
            </p>
          )}
        </fieldset>

        {/* Totals */}
        <dl className="mt-8 space-y-2 border-t border-white/10 pt-6 text-sm">
          <div className="flex justify-between text-text-muted">
            <dt>
              Subtotal ({totalQty} {totalQty === 1 ? 'shirt' : 'shirts'} ×{' '}
              {formatAUD(unit)})
            </dt>
            <dd>{formatAUD(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-text-muted">
            <dt>Shipping</dt>
            <dd>{totalQty > 0 ? formatAUD(SHIPPING_CENTS) : '—'}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-semibold text-white">
            <dt>Total</dt>
            <dd>{formatAUD(orderTotal)}</dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="mt-4 text-sm text-error">
            {error}
          </p>
        )}

        <Button
          variant="accent"
          size="lg"
          className="mt-6 w-full"
          onClick={handleBuy}
          disabled={loading || totalQty === 0}
        >
          {loading ? 'Redirecting…' : 'Buy now'}
        </Button>
        <p className="mt-3 text-center text-xs text-text-dim">
          Secure checkout by Stripe · Apple Pay &amp; Google Pay supported
        </p>

        {isTestMode && (
          <p className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-center text-xs text-accent">
            Test mode — pay with card <strong>4242 4242 4242 4242</strong>, any
            future expiry, any CVC. No real charge is made.
          </p>
        )}
      </div>
    </div>
  )
}
