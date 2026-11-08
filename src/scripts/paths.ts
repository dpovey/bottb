/**
 * Default filesystem locations for CLI scripts.
 *
 * Every default can be overridden with an environment variable (or the
 * script's own CLI flag where it has one). Defaults are the current external
 * drive path or /tmp, never a user home directory.
 */
import { join } from 'path'

const DEFAULT_VOLUME = '/Volumes/Extreme SSD'
// /tmp, not os.tmpdir(): on macOS that is a per-shell $TMPDIR (a session scratchpad
// in agent shells), so a resume from another shell would miss a checkpoint and
// redo its uploads.
const DEFAULT_TMP = '/tmp'

type Env = Record<string, string | undefined>

/** Root of the photo drive. Override with BOTTB_PHOTOS_VOLUME. */
export function photosVolume(env: Env = process.env): string {
  return env.BOTTB_PHOTOS_VOLUME || DEFAULT_VOLUME
}

/** Event photo folders. Override with BOTTB_PHOTOS_DIR. */
export function photosBasePath(env: Env = process.env): string {
  return env.BOTTB_PHOTOS_DIR || join(photosVolume(env), 'Photos')
}

/** Google Photos export folder. Override with BOTTB_GOOGLE_PHOTOS_DIR. */
export function googlePhotosBasePath(env: Env = process.env): string {
  return env.BOTTB_GOOGLE_PHOTOS_DIR || join(photosVolume(env), 'Google Photos')
}

/** Song overlay output base. Override with BOTTB_PRODUCTION_DIR. */
export function productionOutBase(env: Env = process.env): string {
  return (
    env.BOTTB_PRODUCTION_DIR ||
    join(photosVolume(env), 'bottb/events/2026/Brisbane/02_Production')
  )
}

/** Dir for script checkpoints and temp files. Override with BOTTB_TMP_DIR. */
export function scratchDir(env: Env = process.env): string {
  return env.BOTTB_TMP_DIR || DEFAULT_TMP
}
