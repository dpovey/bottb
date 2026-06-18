import { describe, it, expect } from 'vitest'
import { formatAUD } from '../currency'

describe('formatAUD', () => {
  it('formats whole dollars', () => {
    expect(formatAUD(5000)).toBe('$50.00')
    expect(formatAUD(500)).toBe('$5.00')
  })

  it('formats zero', () => {
    expect(formatAUD(0)).toBe('$0.00')
  })

  it('formats cents', () => {
    expect(formatAUD(12345)).toBe('$123.45')
  })
})
