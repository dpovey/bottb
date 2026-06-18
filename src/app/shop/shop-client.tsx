'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatAUD } from '@/lib/currency'
import {
  MAX_QUANTITY,
  SHIPPING_CENTS,
  TSHIRT,
  TSHIRT_SIZES,
  type TShirtSize,
} from '@/lib/shop/config'

const isTestMode = (
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
).startsWith('pk_test')

export function ShopClient() {
  const [activeImage, setActiveImage] = useState(0)
  const [size, setSize] = useState<TShirtSize | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = TSHIRT.priceCents * quantity
  const total = subtotal + SHIPPING_CENTS

  async function handleBuy() {
    if (!size) {
      setError('Please choose a size.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ size, quantity }),
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
        <p className="mt-6 leading-relaxed text-text-muted">
          {TSHIRT.description}
        </p>

        {/* Size */}
        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-white">Size</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {TSHIRT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSize(s)
                  setError(null)
                }}
                aria-pressed={size === s}
                className={`min-w-[3.5rem] rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  size === s
                    ? 'border-accent bg-accent text-white'
                    : 'border-white/30 text-white hover:border-white/60 hover:bg-white/5'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Quantity */}
        <div className="mt-6">
          <label htmlFor="quantity" className="text-sm font-medium text-white">
            Quantity
          </label>
          <select
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className={cn(
              'mt-3 block w-24 rounded-lg border border-white/20 bg-bg-elevated py-2 pl-3 pr-9 text-white',
              'focus:border-accent focus:outline-hidden',
              // Replace the native arrow (which has no padding control) with a
              // custom chevron, matching FilterSelect's treatment.
              'appearance-none bg-no-repeat bg-size-[1.25em_1.25em] bg-position-[right_0.5rem_center]',
              "bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')]"
            )}
          >
            {Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Totals */}
        <dl className="mt-8 space-y-2 border-t border-white/10 pt-6 text-sm">
          <div className="flex justify-between text-text-muted">
            <dt>
              Subtotal ({quantity} × {formatAUD(TSHIRT.priceCents)})
            </dt>
            <dd>{formatAUD(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-text-muted">
            <dt>Shipping</dt>
            <dd>{formatAUD(SHIPPING_CENTS)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-semibold text-white">
            <dt>Total</dt>
            <dd>{formatAUD(total)}</dd>
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
          disabled={loading}
        >
          {loading ? 'Redirecting…' : 'Buy now'}
        </Button>
        <p className="mt-3 text-center text-xs text-text-dim">
          Secure checkout by Stripe · Apple Pay & Google Pay supported
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
