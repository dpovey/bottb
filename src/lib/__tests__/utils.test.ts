import { describe, it, expect } from 'vitest'
import { slugify } from '../utils'

describe('slugify', () => {
  it('converts basic text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces multiple spaces with single hyphen', () => {
    expect(slugify('Hello    World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify("Rock & Roll's Best!")).toBe('rock-rolls-best')
    expect(slugify('AC/DC')).toBe('acdc')
    expect(slugify("Guns N' Roses")).toBe('guns-n-roses')
  })

  it('handles unicode characters', () => {
    // Accented chars are removed by the regex
    expect(slugify('Café Münchën')).toBe('caf-mnchn')
    expect(slugify('日本語')).toBe('')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world')
    expect(slugify('---hello---')).toBe('hello')
  })

  it('replaces multiple hyphens with single hyphen', () => {
    expect(slugify('hello---world')).toBe('hello-world')
    expect(slugify('a - b - c')).toBe('a-b-c')
  })

  it('handles empty and whitespace-only strings', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
  })

  it('preserves numbers', () => {
    expect(slugify('Sydney 2025')).toBe('sydney-2025')
    expect(slugify('80s Rock')).toBe('80s-rock')
  })

  it('handles artist names correctly', () => {
    expect(slugify('Queen')).toBe('queen')
    expect(slugify("Guns N' Roses")).toBe('guns-n-roses')
    expect(slugify('AC/DC')).toBe('acdc')
    expect(slugify('The Black Keys')).toBe('the-black-keys')
  })

  it('handles song titles correctly', () => {
    expect(slugify('Bohemian Rhapsody')).toBe('bohemian-rhapsody')
    expect(slugify("Don't Stop Me Now")).toBe('dont-stop-me-now')
    expect(slugify('Welcome to the Jungle')).toBe('welcome-to-the-jungle')
  })

  it('handles photographer names', () => {
    expect(slugify('Renee Andrews')).toBe('renee-andrews')
    expect(slugify('Jacob Briant')).toBe('jacob-briant')
    expect(slugify("John O'Brien")).toBe('john-obrien')
  })
})
