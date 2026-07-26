import { describe, expect, it } from 'vitest'
import { createZip, crc32, type ZipEntry } from '../zip'

const STAMP = new Date(2026, 6, 26, 12, 30, 0)
const bytes = (s: string) => new TextEncoder().encode(s)

/** Little-endian readers, matching the format's byte order. */
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8)
const u32 = (b: Uint8Array, at: number) =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0

describe('crc32', () => {
  it('matches the standard check vector', () => {
    // The IEEE 802.3 check value for "123456789".
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
  })

  it('is 0 for empty input', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('differs for differing input', () => {
    expect(crc32(bytes('a'))).not.toBe(crc32(bytes('b')))
  })
})

describe('createZip', () => {
  const entries: ZipEntry[] = [
    { name: 'hello.txt', data: bytes('hello world\n') },
    { name: 'nested/second.txt', data: bytes('second\n') },
  ]

  it('starts with a local file header and ends with an EOCD record', () => {
    const zip = createZip(entries, STAMP)
    expect(u32(zip, 0)).toBe(0x04034b50)
    expect(u32(zip, zip.length - 22)).toBe(0x06054b50)
  })

  it('records every entry once in the central directory', () => {
    const zip = createZip(entries, STAMP)
    const eocd = zip.length - 22
    expect(u16(zip, eocd + 8)).toBe(entries.length)
    expect(u16(zip, eocd + 10)).toBe(entries.length)
  })

  it('stores entries uncompressed, with matching sizes', () => {
    const zip = createZip([entries[0]], STAMP)
    expect(u16(zip, 8)).toBe(0) // method 0 = stored
    expect(u32(zip, 18)).toBe(entries[0].data.length) // compressed
    expect(u32(zip, 22)).toBe(entries[0].data.length) // uncompressed
  })

  it('carries the CRC of each entry', () => {
    const zip = createZip([entries[0]], STAMP)
    expect(u32(zip, 14)).toBe(crc32(entries[0].data))
  })

  it('writes the file name and its bytes verbatim', () => {
    const zip = createZip([entries[0]], STAMP)
    const nameLen = u16(zip, 26)
    const name = new TextDecoder().decode(zip.slice(30, 30 + nameLen))
    expect(name).toBe('hello.txt')
    const data = zip.slice(30 + nameLen, 30 + nameLen + entries[0].data.length)
    expect(new TextDecoder().decode(data)).toBe('hello world\n')
  })

  it('points the central directory at the right offset', () => {
    const zip = createZip(entries, STAMP)
    const eocd = zip.length - 22
    const centralOffset = u32(zip, eocd + 16)
    expect(u32(zip, centralOffset)).toBe(0x02014b50)
  })

  it('is deterministic for the same input and timestamp', () => {
    expect(createZip(entries, STAMP)).toEqual(createZip(entries, STAMP))
  })

  it('produces a valid, empty archive for no entries', () => {
    const zip = createZip([], STAMP)
    expect(zip.length).toBe(22)
    expect(u32(zip, 0)).toBe(0x06054b50)
  })
})
