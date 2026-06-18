import { describe, it, expect } from 'vitest'
import {
  isValidSize,
  TSHIRT_SIZES,
  TSHIRT_UNIT_PRICE_CENTS,
  TSHIRT_BULK_UNIT_PRICE_CENTS,
  TSHIRT_BULK_MIN_QTY,
  SHIPPING_CENTS,
  MAX_QUANTITY,
  unitPriceCents,
  parseOrderItems,
  totalQuantity,
  SELLER,
} from '../config'

describe('shop config', () => {
  it('accepts every advertised size', () => {
    for (const size of TSHIRT_SIZES) {
      expect(isValidSize(size)).toBe(true)
    }
  })

  it('rejects unknown or non-string sizes', () => {
    expect(isValidSize('XS')).toBe(false)
    expect(isValidSize('m')).toBe(false)
    expect(isValidSize(1)).toBe(false)
    expect(isValidSize(null)).toBe(false)
    expect(isValidSize(undefined)).toBe(false)
  })

  it('prices a single shirt at $40, bulk at $35, shipping $10', () => {
    expect(TSHIRT_UNIT_PRICE_CENTS).toBe(4000)
    expect(TSHIRT_BULK_UNIT_PRICE_CENTS).toBe(3500)
    expect(SHIPPING_CENTS).toBe(1000)
    expect(TSHIRT_BULK_MIN_QTY).toBe(2)
  })

  it('applies the volume discount at two or more', () => {
    expect(unitPriceCents(1)).toBe(4000)
    expect(unitPriceCents(2)).toBe(3500)
    expect(unitPriceCents(5)).toBe(3500)
  })

  it('sells as a non-GST-registered entity (invoice, not tax invoice)', () => {
    expect(SELLER.gstRegistered).toBe(false)
    expect(SELLER.abn).toBe('19 691 201 153')
  })
})

describe('parseOrderItems', () => {
  it('accepts a valid multi-size order and drops zero-qty entries', () => {
    expect(
      parseOrderItems([
        { size: 'M', quantity: 1 },
        { size: 'L', quantity: 2 },
        { size: 'S', quantity: 0 },
      ])
    ).toEqual([
      { size: 'M', quantity: 1 },
      { size: 'L', quantity: 2 },
    ])
  })

  it('totals quantities across sizes', () => {
    const items = parseOrderItems([
      { size: 'M', quantity: 1 },
      { size: 'L', quantity: 2 },
    ])
    expect(items && totalQuantity(items)).toBe(3)
  })

  it('rejects empty, unknown-size, duplicate, non-array, or over-max orders', () => {
    expect(parseOrderItems([])).toBeNull()
    expect(parseOrderItems('nope')).toBeNull()
    expect(parseOrderItems([{ size: 'XS', quantity: 1 }])).toBeNull()
    expect(parseOrderItems([{ size: 'M', quantity: 1.5 }])).toBeNull()
    expect(
      parseOrderItems([
        { size: 'M', quantity: 1 },
        { size: 'M', quantity: 1 },
      ])
    ).toBeNull()
    expect(
      parseOrderItems([{ size: 'M', quantity: MAX_QUANTITY + 1 }])
    ).toBeNull()
  })
})
