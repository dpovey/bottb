import { describe, it, expect } from 'vitest'
import {
  getPhotoDownload,
  getUrlExtension,
  type PhotoDownloadSource,
} from '../photo-download'

const BLOB = 'https://abc.public.blob.vercel-storage.com'

function makePhoto(
  overrides: Partial<PhotoDownloadSource> = {}
): PhotoDownloadSource {
  return {
    id: '0123456789abcdef',
    blob_url: `${BLOB}/photos/0123/large.webp`,
    original_blob_url: `${BLOB}/photos/0123/original.jpg`,
    original_filename: 'IMG_1234.jpg',
    band_id: 'the-fuggles-brisbane-2024',
    event_name: 'Brisbane 2024',
    ...overrides,
  }
}

describe('getPhotoDownload', () => {
  it('downloads the original under its uploaded filename', () => {
    expect(getPhotoDownload(makePhoto())).toEqual({
      url: `${BLOB}/photos/0123/original.jpg`,
      filename: 'IMG_1234.jpg',
    })
  })

  it('falls back to the large WebP with a .webp name when there is no original', () => {
    expect(getPhotoDownload(makePhoto({ original_blob_url: null }))).toEqual({
      url: `${BLOB}/photos/0123/large.webp`,
      filename: 'IMG_1234.webp',
    })
  })

  it('builds a name from the band when the original filename is missing', () => {
    expect(
      getPhotoDownload(makePhoto({ original_filename: null })).filename
    ).toBe('bottb-the-fuggles-brisbane-2024-01234567.jpg')
  })

  it('builds a name from the event when there is no band or filename', () => {
    expect(
      getPhotoDownload(
        makePhoto({
          original_filename: null,
          original_blob_url: null,
          band_id: null,
        })
      ).filename
    ).toBe('bottb-brisbane-2024-01234567.webp')
  })

  it('ignores the query string when taking the extension', () => {
    const download = getPhotoDownload(
      makePhoto({
        original_filename: null,
        original_blob_url: `${BLOB}/photos/0123/original.PNG?download=1#x`,
      })
    )
    expect(download.url).toBe(`${BLOB}/photos/0123/original.PNG?download=1#x`)
    expect(download.filename).toBe(
      'bottb-the-fuggles-brisbane-2024-01234567.png'
    )
  })
})

describe('getUrlExtension', () => {
  it('returns null when the path has no extension', () => {
    expect(getUrlExtension(`${BLOB}/photos/0123/original`)).toBeNull()
  })

  it('ignores dots in the host and query', () => {
    expect(getUrlExtension(`${BLOB}/photos/large.webp?v=1.2`)).toBe('webp')
  })
})
