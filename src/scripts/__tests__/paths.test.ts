import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  photosBasePath,
  googlePhotosBasePath,
  productionOutBase,
  scratchDir,
} from '../paths'

describe('script path defaults', () => {
  it('use the current volume and platform temp dir', () => {
    expect(photosBasePath({})).toBe('/Volumes/Extreme SSD/Photos')
    expect(googlePhotosBasePath({})).toBe('/Volumes/Extreme SSD/Google Photos')
    expect(productionOutBase({})).toBe(
      '/Volumes/Extreme SSD/bottb/events/2026/Brisbane/02_Production'
    )
    expect(scratchDir({})).toBe(tmpdir())
  })

  it('can be overridden by environment variables', () => {
    expect(photosBasePath({ BOTTB_PHOTOS_DIR: '/x/p' })).toBe('/x/p')
    expect(googlePhotosBasePath({ BOTTB_PHOTOS_VOLUME: '/v' })).toBe(
      '/v/Google Photos'
    )
    expect(productionOutBase({ BOTTB_PRODUCTION_DIR: '/x/o' })).toBe('/x/o')
    expect(scratchDir({ BOTTB_TMP_DIR: '/x/t' })).toBe('/x/t')
  })

  it('no script defaults name the old Mac home or a hardcoded /tmp', () => {
    const dir = join(__dirname, '..')
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts') && !f.includes('__tests__'))
      .map((f) => join(dir, f))
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toContain('/Users/deapovey')
      expect(src, f).not.toMatch(/['"`]\/tmp\//)
    }
  })
})
