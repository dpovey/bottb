import { describe, it, expect } from 'vitest'
import { seededShuffle, getTimeBasedSeed } from '../shuffle'

describe('seededShuffle', () => {
  it('same seed produces identical order across multiple calls', () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const seed = 'test-seed-123'

    const result1 = seededShuffle(array, seed)
    const result2 = seededShuffle(array, seed)
    const result3 = seededShuffle(array, seed)

    expect(result1).toEqual(result2)
    expect(result2).toEqual(result3)
  })

  it('different seeds produce different orders', () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const seed1 = 'seed-one'
    const seed2 = 'seed-two'

    const result1 = seededShuffle(array, seed1)
    const result2 = seededShuffle(array, seed2)

    // Different seeds should produce different orders (very high probability)
    expect(result1).not.toEqual(result2)
  })

  it('handles empty array', () => {
    const array: number[] = []
    const seed = 'test-seed'

    const result = seededShuffle(array, seed)

    expect(result).toEqual([])
    expect(result).not.toBe(array) // Should be a new array
  })

  it('handles single item array', () => {
    const array = [42]
    const seed = 'test-seed'

    const result = seededShuffle(array, seed)

    expect(result).toEqual([42])
    expect(result).not.toBe(array) // Should be a new array
  })

  it('shuffles large arrays correctly', () => {
    const array = Array.from({ length: 1000 }, (_, i) => i)
    const seed = 'large-array-seed'

    const result = seededShuffle(array, seed)

    // Should have same length
    expect(result).toHaveLength(array.length)

    // Should contain all original elements
    const sortedResult = [...result].sort((a, b) => a - b)
    expect(sortedResult).toEqual(array)

    // Should be shuffled (very high probability it won't be in order)
    expect(result).not.toEqual(array)
  })

  it('does not modify original array', () => {
    const array = [1, 2, 3, 4, 5]
    const originalCopy = [...array]
    const seed = 'test-seed'

    seededShuffle(array, seed)

    expect(array).toEqual(originalCopy)
  })

  it('produces consistent results across different array references', () => {
    const seed = 'consistent-seed'

    const array1 = [1, 2, 3, 4, 5]
    const array2 = [1, 2, 3, 4, 5]

    const result1 = seededShuffle(array1, seed)
    const result2 = seededShuffle(array2, seed)

    expect(result1).toEqual(result2)
  })

  it('shuffles objects correctly', () => {
    const array = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Charlie' },
      { id: 'd', name: 'David' },
    ]
    const seed = 'object-seed'

    const result1 = seededShuffle(array, seed)
    const result2 = seededShuffle(array, seed)

    expect(result1).toEqual(result2)
    expect(result1).toHaveLength(array.length)

    // All original objects should be present
    const resultIds = result1.map((item) => item.id).sort()
    expect(resultIds).toEqual(['a', 'b', 'c', 'd'])
  })

  it('numeric seeds work consistently', () => {
    const array = [1, 2, 3, 4, 5]
    const seed = '12345' // String representation of number

    const result1 = seededShuffle(array, seed)
    const result2 = seededShuffle(array, seed)

    expect(result1).toEqual(result2)
  })
})

describe('getTimeBasedSeed', () => {
  it('returns a string', () => {
    const seed = getTimeBasedSeed()
    expect(typeof seed).toBe('string')
  })

  it('returns same value when called quickly in succession', () => {
    const seed1 = getTimeBasedSeed()
    const seed2 = getTimeBasedSeed()

    // Both calls within same 15-minute window should return same seed
    expect(seed1).toBe(seed2)
  })

  it('seed is based on 15-minute intervals', () => {
    // The seed should be the floor of timestamp / (15 * 60 * 1000)
    const now = Date.now()
    const expectedSeed = Math.floor(now / (15 * 60 * 1000)).toString()
    const actualSeed = getTimeBasedSeed()

    expect(actualSeed).toBe(expectedSeed)
  })
})
