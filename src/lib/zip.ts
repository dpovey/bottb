/**
 * A minimal ZIP writer, so the admin generators can hand back a batch of PNGs
 * as one download without pulling in a compression library.
 *
 * Entries are stored, not deflated. That is not a shortcut: PNG is already
 * DEFLATE-compressed internally, so re-compressing it buys ~0% and costs CPU
 * on what can be a few dozen 4K frames. Storing keeps the writer to the
 * handful of well-specified records below.
 *
 * Covers the common subset of APPNOTE.TXT: local file headers, a central
 * directory, and an end-of-central-directory record. No Zip64 (archives here
 * are far below 4GB), no encryption, no directory entries.
 */

/** CRC-32 (IEEE 802.3), the checksum ZIP entries carry. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** One file to place in the archive. */
export interface ZipEntry {
  /** Path inside the archive. Forward slashes; no leading slash. */
  name: string
  data: Uint8Array
}

class ByteWriter {
  private parts: Uint8Array[] = []
  length = 0

  push(bytes: Uint8Array): void {
    this.parts.push(bytes)
    this.length += bytes.length
  }

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]))
  }

  u32(value: number): void {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ])
    )
  }

  concat(): Uint8Array {
    const out = new Uint8Array(this.length)
    let at = 0
    for (const part of this.parts) {
      out.set(part, at)
      at += part.length
    }
    return out
  }
}

/**
 * DOS date/time, the format ZIP has always used for timestamps. Takes an
 * explicit `Date` so callers stay deterministic in tests.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f)
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate()
  return { time, date: day }
}

/**
 * Build a ZIP archive containing `entries`, stored without compression.
 *
 * `modified` stamps every entry; it is a parameter rather than `new Date()` so
 * the output is reproducible.
 */
export function createZip(entries: ZipEntry[], modified: Date): Uint8Array {
  const encoder = new TextEncoder()
  const { time, date } = dosDateTime(modified)
  const body = new ByteWriter()
  const central = new ByteWriter()

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const sum = crc32(entry.data)
    const offset = body.length

    // Local file header.
    body.u32(0x04034b50)
    body.u16(20) // version needed: 2.0
    body.u16(0) // flags
    body.u16(0) // method: stored
    body.u16(time)
    body.u16(date)
    body.u32(sum)
    body.u32(entry.data.length) // compressed size
    body.u32(entry.data.length) // uncompressed size
    body.u16(name.length)
    body.u16(0) // extra field length
    body.push(name)
    body.push(entry.data)

    // Matching central-directory record.
    central.u32(0x02014b50)
    central.u16(20) // version made by
    central.u16(20) // version needed
    central.u16(0)
    central.u16(0)
    central.u16(time)
    central.u16(date)
    central.u32(sum)
    central.u32(entry.data.length)
    central.u32(entry.data.length)
    central.u16(name.length)
    central.u16(0) // extra
    central.u16(0) // comment
    central.u16(0) // disk number
    central.u16(0) // internal attributes
    central.u32(0) // external attributes
    central.u32(offset)
    central.push(name)
  }

  const out = new ByteWriter()
  out.push(body.concat())
  const centralBytes = central.concat()
  out.push(centralBytes)

  // End of central directory.
  out.u32(0x06054b50)
  out.u16(0) // this disk
  out.u16(0) // disk with central directory
  out.u16(entries.length)
  out.u16(entries.length)
  out.u32(centralBytes.length)
  out.u32(body.length)
  out.u16(0) // comment length

  return out.concat()
}

/** Convenience wrapper producing a Blob ready for a download link. */
export function createZipBlob(entries: ZipEntry[], modified: Date): Blob {
  const bytes = createZip(entries, modified)
  return new Blob([bytes as unknown as BlobPart], { type: 'application/zip' })
}
