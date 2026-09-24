/**
 * Where offline model artifacts land.
 *
 * data/model/ is gitignored: it holds derived vendor data that must not be
 * committed. Only hand-curated exports under src/data/generated/ cross into
 * the app. See data/model/README.md.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { REPO_ROOT } from '../ingest/fantasypros/source.mjs'

export const MODEL_DIR = path.join(REPO_ROOT, 'data', 'model')

/** Write pretty-printed JSON into data/model/ and return the repo-relative path. */
export async function writeModelJson(fileName, payload) {
  const filePath = path.join(MODEL_DIR, fileName)
  await mkdir(MODEL_DIR, { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return path.relative(REPO_ROOT, filePath)
}
