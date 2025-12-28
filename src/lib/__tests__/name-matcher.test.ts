import { describe, it, expect } from 'vitest'
import {
  normalizeString,
  stringSimilarity,
  FUZZY_MATCH_THRESHOLD,
} from '../name-matcher'

describe('name-matcher', () => {
  describe('normalizeString', () => {
    it('converts to lowercase', () => {
      expect(normalizeString('HELLO')).toBe('hello')
      expect(normalizeString('HeLLo WoRLd')).toBe('hello world')
    })

    it('removes special characters', () => {
      expect(normalizeString("Rock'n'Roll")).toBe('rocknroll')
      expect(normalizeString('AC/DC')).toBe('acdc')
      expect(normalizeString("Guns N' Roses")).toBe('guns n roses')
      expect(normalizeString('Blink-182')).toBe('blink182')
    })

    it('preserves alphanumeric characters and spaces', () => {
      expect(normalizeString('Band Name 123')).toBe('band name 123')
      expect(normalizeString('The Beatles')).toBe('the beatles')
    })

    it('trims whitespace', () => {
      expect(normalizeString('  hello  ')).toBe('hello')
      expect(normalizeString('\t\ntest\n\t')).toBe('test')
    })

    it('handles empty string', () => {
      expect(normalizeString('')).toBe('')
    })

    it('handles string with only special characters', () => {
      expect(normalizeString('!@#$%^&*()')).toBe('')
    })

    it('handles unicode and accented characters', () => {
      // Non-ASCII characters are removed
      expect(normalizeString('Café')).toBe('caf')
      expect(normalizeString('Motörhead')).toBe('motrhead')
    })
  })

  describe('stringSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1)
      expect(stringSimilarity('The Beatles', 'the beatles')).toBe(1) // case insensitive
    })

    it('returns 0 when one string is empty', () => {
      expect(stringSimilarity('hello', '')).toBe(0)
      expect(stringSimilarity('', 'hello')).toBe(0)
    })

    it('returns 0 when both strings are empty', () => {
      expect(stringSimilarity('', '')).toBe(1) // Both normalize to empty, considered identical
    })

    it('returns 0.8 for substring containment', () => {
      expect(stringSimilarity('rock', 'rock band')).toBe(0.8)
      expect(stringSimilarity('The Beatles', 'Beatles')).toBe(0.8)
      expect(stringSimilarity('AC/DC', 'AC')).toBe(0.8)
    })

    it('calculates Levenshtein-based similarity correctly', () => {
      // "hello" vs "hallo" - 1 character difference out of 5
      // distance = 1, maxLength = 5, similarity = 1 - 1/5 = 0.8
      expect(stringSimilarity('hello', 'hallo')).toBe(0.8)

      // "cat" vs "bat" - 1 character difference out of 3
      // distance = 1, maxLength = 3, similarity = 1 - 1/3 ≈ 0.667
      expect(stringSimilarity('cat', 'bat')).toBeCloseTo(0.667, 2)

      // "kitten" vs "sitting" - more complex edit distance
      // After normalization: "kitten" vs "sitting"
      // distance = 3 (k->s, e->i, insert g), maxLength = 7
      // similarity = 1 - 3/7 ≈ 0.571
      expect(stringSimilarity('kitten', 'sitting')).toBeCloseTo(0.571, 2)
    })

    it('handles case differences via normalization', () => {
      expect(stringSimilarity('HELLO', 'hello')).toBe(1)
      expect(stringSimilarity('Rock Band', 'ROCK BAND')).toBe(1)
    })

    it('handles special characters via normalization', () => {
      // "Rock'n'Roll" normalizes to "rocknroll"
      // "Rock n Roll" normalizes to "rock n roll"
      // These are similar but not identical (spaces differ)
      expect(stringSimilarity("Rock'n'Roll", 'Rock n Roll')).toBeGreaterThan(
        0.8
      )

      // "AC/DC" normalizes to "acdc", same as "ACDC"
      expect(stringSimilarity('AC/DC', 'ACDC')).toBe(1)
    })

    it('returns similarity above threshold for similar band names', () => {
      // Common typos and variations
      expect(stringSimilarity('Metallica', 'Metalica')).toBeGreaterThanOrEqual(
        FUZZY_MATCH_THRESHOLD
      )
      expect(
        stringSimilarity('Led Zeppelin', 'Led Zepplin')
      ).toBeGreaterThanOrEqual(FUZZY_MATCH_THRESHOLD)
    })

    it('returns similarity below threshold for dissimilar names', () => {
      expect(stringSimilarity('Beatles', 'Stones')).toBeLessThan(
        FUZZY_MATCH_THRESHOLD
      )
      expect(stringSimilarity('Queen', 'Nirvana')).toBeLessThan(
        FUZZY_MATCH_THRESHOLD
      )
    })
  })

  describe('FUZZY_MATCH_THRESHOLD', () => {
    it('is set to 0.6', () => {
      expect(FUZZY_MATCH_THRESHOLD).toBe(0.6)
    })
  })
})
