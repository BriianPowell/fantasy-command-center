/**
 * Locating the raw FantasyPros exports.
 *
 * The CSVs live in Nextcloud rather than in the repo, so the path is
 * machine-specific and must never be hardcoded. Resolution order:
 *
 *   1. `--source <path>` on the command line
 *   2. `FANTASYPROS_DATA_DIR` in the environment or `.env`
 *   3. a single auto-detected `~/Library/CloudStorage/Nextcloud-<account>` that
 *      contains an `NFL Data` folder
 *
 * Auto-detection is a convenience for the common single-account setup; it
 * bails out rather than guessing if it finds zero or several candidates.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

const CLOUD_STORAGE_DIR = path.join(os.homedir(), 'Library', 'CloudStorage')
const NEXTCLOUD_PREFIX = 'Nextcloud-'
const DATA_FOLDER_NAME = 'NFL Data'

/** Load `.env` into `process.env` without clobbering real environment vars. */
export async function loadDotEnv() {
  let contents
  try {
    contents = await readFile(path.join(REPO_ROOT, '.env'), 'utf8')
  } catch {
    return
  }

  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory()
  } catch {
    return false
  }
}

/** Every `NFL Data` folder under a `~/Library/CloudStorage/Nextcloud-...` root. */
async function detectNextcloudDataDirs() {
  let entries
  try {
    entries = await readdir(CLOUD_STORAGE_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const candidates = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(NEXTCLOUD_PREFIX))
      continue
    const candidate = path.join(CLOUD_STORAGE_DIR, entry.name, DATA_FOLDER_NAME)
    if (await isDirectory(candidate)) candidates.push(candidate)
  }
  return candidates
}

export class SourceResolutionError extends Error {}

/**
 * Resolve the directory holding `<season>/FantasyPros_*.csv`.
 *
 * Returns `{ root, origin }` where origin explains which rule won, so CLIs
 * can print it and make a surprising auto-detect obvious.
 */
export async function resolveSourceRoot({ sourceArg } = {}) {
  if (sourceArg) {
    const root = path.resolve(sourceArg)
    if (!(await isDirectory(root))) {
      throw new SourceResolutionError(`--source path does not exist: ${root}`)
    }
    return { root, origin: '--source' }
  }

  await loadDotEnv()
  const configured = process.env.FANTASYPROS_DATA_DIR
  if (configured) {
    const root = path.resolve(configured)
    if (!(await isDirectory(root))) {
      throw new SourceResolutionError(
        `FANTASYPROS_DATA_DIR points at a missing directory: ${root}`
      )
    }
    return { root, origin: 'FANTASYPROS_DATA_DIR' }
  }

  const detected = await detectNextcloudDataDirs()
  if (detected.length === 1) {
    return { root: detected[0], origin: 'auto-detected Nextcloud folder' }
  }

  if (detected.length > 1) {
    throw new SourceResolutionError(
      `Found several Nextcloud "${DATA_FOLDER_NAME}" folders; set FANTASYPROS_DATA_DIR in .env to pick one:\n` +
        detected.map((dir) => `  ${dir}`).join('\n')
    )
  }

  throw new SourceResolutionError(
    `Could not find the raw FantasyPros exports.\n` +
      `Set FANTASYPROS_DATA_DIR in .env (see .env.example) to the folder that holds <season>/ subfolders, ` +
      `or pass --source <path>.`
  )
}

/** Season subfolders, newest last. Only four-digit names count. */
export async function listSeasons(root) {
  const entries = await readdir(root, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}
