/**
 * Output discipline for the `bottb` CLI.
 *
 * stdout carries the ANSWER and nothing else. Every note, warning, progress
 * line and transport report goes to stderr. That is what makes `--json` safe
 * to pipe into a Claude skill, or into jq, without a stray "connecting..."
 * line breaking the parse.
 */

let jsonMode = false
let quiet = false

export function setJsonMode(on: boolean) {
  jsonMode = on
}

export function setQuiet(on: boolean) {
  quiet = on
}

/** A note for the human. Always stderr, never stdout. */
export function log(message: string) {
  if (!quiet) process.stderr.write(`[bottb] ${message}\n`)
}

export function warn(message: string) {
  process.stderr.write(`[bottb] WARNING: ${message}\n`)
}

/** The envelope every --json response uses. */
export interface Envelope<T> {
  ok: boolean
  command: string
  data?: T
  error?: { code: string; message: string }
  meta: {
    transport?: string
    count?: number
    dryRun?: boolean
    [key: string]: unknown
  }
}

export function emitJson<T>(
  command: string,
  data: T,
  meta: Envelope<T>['meta'] = {}
) {
  const envelope: Envelope<T> = { ok: true, command, data, meta }
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`)
}

export function emitJsonError(command: string, code: string, message: string) {
  const envelope: Envelope<never> = {
    ok: false,
    command,
    error: { code, message },
    meta: {},
  }
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`)
}

/** Plain text straight to stdout. Used for the human-readable renderings. */
export function out(text: string) {
  process.stdout.write(`${text}\n`)
}

export function isJson() {
  return jsonMode
}

/**
 * A timestamp cut to the minute for a table cell. Postgres drivers hand back
 * timestamptz columns as Date objects even though db-types says string, so
 * `.slice` on them threw ("slice is not a function", `post list`, 16 Nov 2026).
 * A Date prints in UTC with a Z; a string keeps its own offset and is cut as is.
 */
export function minuteCell(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : `${value.toISOString().slice(0, 16)}Z`
  }
  return String(value).slice(0, 16)
}

/** A minimal aligned table. No dependency, no box drawing, pipe-friendly. */
export function table(headers: string[], rows: (string | null)[][]): string {
  const cells = rows.map((r) => r.map((c) => (c === null ? '-' : String(c))))
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...cells.map((r) => (r[i] ?? '').length), 1)
  )
  const line = (cols: string[]) =>
    cols
      .map((c, i) => c.padEnd(widths[i]))
      .join('  ')
      .trimEnd()
  return [
    line(headers),
    line(widths.map((w) => '-'.repeat(w))),
    ...cells.map(line),
  ].join('\n')
}

export class CliError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
