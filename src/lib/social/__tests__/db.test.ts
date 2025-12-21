/**
 * Tests for social sharing database helpers
 */

import { describe, it, expect } from 'vitest'
import { applyTemplatePlaceholders } from '../db'

describe('Social DB Helpers', () => {
  describe('applyTemplatePlaceholders', () => {
    it('replaces all placeholders with context values', () => {
      const template =
        'Check out {band} at {event} in {location}! 📸 by {photographer}'
      const context = {
        band: 'The Debuggers',
        event: 'Brisbane 2025',
        location: 'Brisbane',
        photographer: 'John Smith',
      }

      const result = applyTemplatePlaceholders(template, context)

      expect(result).toBe(
        'Check out The Debuggers at Brisbane 2025 in Brisbane! 📸 by John Smith'
      )
    })

    it('handles missing context values gracefully', () => {
      const template = '{band} at {event} - Photos by {photographer}'
      const context = {
        band: 'The Debuggers',
        // event and photographer missing
      }

      const result = applyTemplatePlaceholders(template, context)

      // Missing placeholders remain unchanged
      expect(result).toBe('The Debuggers at {event} - Photos by {photographer}')
    })

    it('replaces multiple occurrences of same placeholder', () => {
      const template = '{band} rocks! {band} is the best! Go {band}!'
      const context = {
        band: 'Stack Overflow',
      }

      const result = applyTemplatePlaceholders(template, context)

      expect(result).toBe(
        'Stack Overflow rocks! Stack Overflow is the best! Go Stack Overflow!'
      )
    })

    it('handles empty template', () => {
      const result = applyTemplatePlaceholders('', { band: 'Test' })
      expect(result).toBe('')
    })

    it('handles template with no placeholders', () => {
      const template = 'Just a regular caption with no variables'
      const result = applyTemplatePlaceholders(template, { band: 'Test' })
      expect(result).toBe(template)
    })

    it('handles all supported placeholders', () => {
      const template =
        '{band} - {event} - {date} - {location} - {photographer} - {company}'
      const context = {
        band: 'The Compilers',
        event: 'Sydney Tech Battle',
        date: 'March 2025',
        location: 'Sydney',
        photographer: 'Jane Doe',
        company: 'TechCorp',
      }

      const result = applyTemplatePlaceholders(template, context)

      expect(result).toBe(
        'The Compilers - Sydney Tech Battle - March 2025 - Sydney - Jane Doe - TechCorp'
      )
    })

    it('handles special characters in context values', () => {
      const template = 'Photo: {band} at {event}'
      const context = {
        band: 'C++ & Friends',
        event: 'Tech <Battle> 2025',
      }

      const result = applyTemplatePlaceholders(template, context)

      expect(result).toBe('Photo: C++ & Friends at Tech <Battle> 2025')
    })
  })
})
