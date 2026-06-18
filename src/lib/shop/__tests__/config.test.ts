import { describe, it, expect } from 'vitest'
import {
  isValidSize,
  TSHIRT_SIZES,
  TSHIRT_PRICE_CENTS,
  SHIPPING_CENTS,
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

  it('prices the t-shirt at $35 + $5 shipping', () => {
    expect(TSHIRT_PRICE_CENTS).toBe(3500)
    expect(SHIPPING_CENTS).toBe(500)
  })

  it('sells as a non-GST-registered entity (invoice, not tax invoice)', () => {
    expect(SELLER.gstRegistered).toBe(false)
    expect(SELLER.abn).toBe('19 691 201 153')
  })
})
