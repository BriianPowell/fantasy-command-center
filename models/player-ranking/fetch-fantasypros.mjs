#!/usr/bin/env node
/**
 * Pull raw FantasyPros NFL data into local, gitignored snapshots under
 * data/raw/fantasypros/<season>/.
 *
 * This is an OFFLINE, LOCAL-ONLY script. It is never imported by the web app.
 * The FantasyPros free/premium API tiers are personal + non-commercial and do
 * not include redistribution rights, so raw responses stay out of the
 * (public) git repo. See data/raw/README.md.
 *
 * Requires FANTASYPROS_API_KEY in the environment (see .env.example).
 *
 * Usage:
 *   FANTASYPROS_API_KEY=xxxxx node models/player-ranking/fetch-fantasypros.mjs --season 2025
 *   node models/player-ranking/fetch-fantasypros.mjs --season 2025 --positions QB,RB,WR,TE,K,DST
 *   node models/player-ranking/fetch-fantasypros.mjs --season 2025 --start 1 --end 17
 *
 * Loads a local .env file (if present) so you don't have to export the key
 * in your shell every time.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const BASE_URL = 'https://api.fantasypros.com/public/v2/json/nfl'
// FantasyPros uses "DST" for team defense; our domain's Position type uses
// "DEF" (see src/domain/types.ts). Map DST -> DEF during normalization, not here.
const DEFAULT_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']

async function loadDotEnv() {
  const envPath = path.join(REPO_ROOT, '.env')
  let contents
  try {
    contents = await readFile(envPath, 'utf8')
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
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const args = { season: String(new Date().getFullYear()), positions: DEFAULT_POSITIONS }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--season') {
      args.season = argv[++i]
    } else if (arg === '--positions') {
      args.positions = argv[++i].split(',').map((p) => p.trim().toUpperCase())
    } else if (arg === '--start') {
      args.start = argv[++i]
    } else if (arg === '--end') {
      args.end = argv[++i]
    } else if (arg === '--scoring') {
      args.scoring = argv[++i]
    }
  }
  return args
}

async function fetchJson(url, apiKey) {
  const response = await fetch(url, { headers: { 'x-api-key': apiKey } })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Request failed (${response.status} ${response.statusText}) for ${url}\n${body}`)
  }
  return response.json()
}

async function writeSnapshot(season, filename, data) {
  const dir = path.join(REPO_ROOT, 'data', 'raw', 'fantasypros', season)
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, filename)
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${path.relative(REPO_ROOT, filePath)}`)
}

async function main() {
  await loadDotEnv()
  const apiKey = process.env.FANTASYPROS_API_KEY
  if (!apiKey) {
    console.error(
      'Missing FANTASYPROS_API_KEY. Copy .env.example to .env and add your key, or export it in your shell.'
    )
    process.exitCode = 1
    return
  }

  const { season, positions, start, end, scoring } = parseArgs(process.argv.slice(2))
  console.log(`Fetching FantasyPros data for ${season} (${positions.join(', ')})...`)

  // Player master list (FantasyPros player ids, teams, positions) for Sleeper matching.
  const players = await fetchJson(`${BASE_URL}/players`, apiKey)
  await writeSnapshot(season, 'players.json', players)

  // Historical fantasy points by week/season, per position.
  for (const position of positions) {
    const params = new URLSearchParams({ position })
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    const pointsUrl = `${BASE_URL}/${season}/player-points?${params.toString()}`
    const points = await fetchJson(pointsUrl, apiKey)
    await writeSnapshot(season, `player-points-${position.toLowerCase()}.json`, points)

    const rankingsParams = new URLSearchParams({ position })
    if (scoring) rankingsParams.set('scoring', scoring)
    const rankingsUrl = `${BASE_URL}/${season}/consensus-rankings?${rankingsParams.toString()}`
    const rankings = await fetchJson(rankingsUrl, apiKey)
    await writeSnapshot(season, `consensus-rankings-${position.toLowerCase()}.json`, rankings)
  }

  console.log('Done. Raw snapshots are gitignored under data/raw/fantasypros/.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
