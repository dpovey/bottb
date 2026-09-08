import { describe, it, expect } from 'vitest'
import { classifyLongForm } from '../video-classification'
import { isVideoType, LONG_FORM_VIDEO_TYPES } from '../db-types'

describe('classifyLongForm', () => {
  it('treats a "(Full Set)" title as a full set regardless of duration', () => {
    expect(classifyLongForm('Epsonics - The Chain (Full Set)', null)).toBe(
      'full_set'
    )
    expect(classifyLongForm('Some Band (Full Set)', 1636)).toBe('full_set')
  })

  it('matches the title marker case-insensitively and without the space', () => {
    expect(classifyLongForm('Some Band (FULL SET)', null)).toBe('full_set')
    expect(classifyLongForm('Some Band fullset', null)).toBe('full_set')
  })

  it('treats anything 15 minutes or longer as a full set', () => {
    expect(classifyLongForm('Melbourne 2026 - Band X', 900)).toBe('full_set')
    expect(classifyLongForm('Melbourne 2026 - Band X', 1296)).toBe('full_set')
  })

  it('leaves single-song videos as regular videos', () => {
    // The longest real single song is 6:19; the shortest full set is 21:36.
    expect(classifyLongForm('Band X - Sweet Child O Mine', 379)).toBe('video')
    expect(classifyLongForm('Band X - Sweet Child O Mine', null)).toBe('video')
    expect(classifyLongForm('', null)).toBe('video')
  })
})

describe('isVideoType', () => {
  it('accepts the three known types', () => {
    expect(isVideoType('video')).toBe(true)
    expect(isVideoType('short')).toBe(true)
    expect(isVideoType('full_set')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isVideoType('fullset')).toBe(false)
    expect(isVideoType('')).toBe(false)
    expect(isVideoType(undefined)).toBe(false)
    expect(isVideoType(null)).toBe(false)
    expect(isVideoType(1)).toBe(false)
  })
})

describe('LONG_FORM_VIDEO_TYPES', () => {
  it('covers everything that is not a Short', () => {
    expect([...LONG_FORM_VIDEO_TYPES].sort()).toEqual(['full_set', 'video'])
  })
})
