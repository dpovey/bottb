/**
 * UUIDv7 Generator
 *
 * UUIDv7 is a time-ordered UUID that's sortable and includes a timestamp.
 * Format: TTTTTTTT-TTTT-7XXX-YXXX-XXXXXXXXXXXX
 * - T: 48-bit timestamp (milliseconds since Unix epoch)
 * - 7: UUID version 7
 * - Y: variant (8, 9, a, or b)
 * - X: random bits
 */

/**
 * Generate a UUIDv7 string
 */
export function uuidv7(): string {
  // Get current timestamp in milliseconds
  const timestamp = Date.now();

  // Generate random bytes for the rest
  const randomBytes = new Uint8Array(10);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 10; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Construct the UUID bytes
  const uuidBytes = new Uint8Array(16);

  // Bytes 0-5: timestamp (48 bits)
  // We need to properly extract bytes from the timestamp
  // Since JS numbers are 64-bit floats, we can safely represent 48-bit integers
  // Break down using division to avoid BigInt
  const ts = timestamp;
  uuidBytes[0] = Math.floor(ts / 0x10000000000) & 0xff; // bits 40-47
  uuidBytes[1] = Math.floor(ts / 0x100000000) & 0xff;   // bits 32-39
  uuidBytes[2] = Math.floor(ts / 0x1000000) & 0xff;     // bits 24-31
  uuidBytes[3] = Math.floor(ts / 0x10000) & 0xff;       // bits 16-23
  uuidBytes[4] = Math.floor(ts / 0x100) & 0xff;         // bits 8-15
  uuidBytes[5] = ts & 0xff;                              // bits 0-7

  // Bytes 6-7: version (7) + random
  uuidBytes[6] = 0x70 | (randomBytes[0] & 0x0f); // Version 7
  uuidBytes[7] = randomBytes[1];

  // Bytes 8-15: variant (10xx) + random
  uuidBytes[8] = 0x80 | (randomBytes[2] & 0x3f); // Variant 10
  uuidBytes[9] = randomBytes[3];
  uuidBytes[10] = randomBytes[4];
  uuidBytes[11] = randomBytes[5];
  uuidBytes[12] = randomBytes[6];
  uuidBytes[13] = randomBytes[7];
  uuidBytes[14] = randomBytes[8];
  uuidBytes[15] = randomBytes[9];

  // Convert to hex string with dashes
  const hex = Array.from(uuidBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Extract timestamp from a UUIDv7
 * @returns Date object or null if not a valid UUIDv7
 */
export function extractTimestamp(uuid: string): Date | null {
  try {
    // Remove dashes and get hex string
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32) return null;

    // Check version (character at position 12 should be '7')
    if (hex[12] !== "7") return null;

    // Extract first 12 hex characters (48 bits of timestamp)
    const timestampHex = hex.slice(0, 12);
    const timestamp = parseInt(timestampHex, 16);

    return new Date(timestamp);
  } catch {
    return null;
  }
}
