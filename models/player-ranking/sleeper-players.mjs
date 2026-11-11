import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { nameMatchKeys } from '../lib/normalize-name.mjs'
import { REPO_ROOT } from '../ingest/fantasypros/source.mjs'
import { vendorNameVariants } from './player-name-aliases.mjs'

function vendorNameLookupKeys(playerName) {
  const keys = new Set()
  for (const variant of vendorNameVariants(playerName)) {
    for (const key of nameMatchKeys(variant)) {
      keys.add(key)
    }
  }
  return [...keys]
}

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl'
const CACHE_PATH = path.join(REPO_ROOT, 'data', 'raw', 'sleeper', 'players-nfl.json')

/** Map FantasyPros/model positions to Sleeper position codes we accept. */
const POSITION_ALIASES = {
  DEF: ['DEF', 'DST'],
  DST: ['DEF', 'DST'],
}

function sleeperPositionsFor(modelPosition) {
  return POSITION_ALIASES[modelPosition] ?? [modelPosition]
}

function displayName(player) {
  return (
    player.full_name ??
    [player.first_name, player.last_name].filter(Boolean).join(' ')
  ).trim()
}

/**
 * Build a lookup from normalized name -> list of Sleeper player records.
 * Only includes players Sleeper marks active unless `includeInactive` is set.
 */
export function indexSleeperPlayers(playersById, { includeInactive = false } = {}) {
  const byName = new Map()

  for (const player of Object.values(playersById)) {
    if (!player?.player_id) continue
    if (!includeInactive && player.active === false) continue

    const name = displayName(player)
    if (!name) continue

    for (const key of nameMatchKeys(name)) {
      const bucket = byName.get(key) ?? []
      if (!bucket.some((entry) => entry.player_id === player.player_id)) {
        bucket.push(player)
      }
      byName.set(key, bucket)
    }
  }

  return byName
}

export async function loadCachedSleeperPlayers() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function fetchSleeperPlayers() {
  const response = await fetch(SLEEPER_PLAYERS_URL)
  if (!response.ok) {
    throw new Error(
      `Sleeper players fetch failed: ${response.status} ${response.statusText}`
    )
  }
  return response.json()
}

export async function resolveSleeperPlayers({ refresh = false } = {}) {
  if (!refresh) {
    const cached = await loadCachedSleeperPlayers()
    if (cached?.players) {
      return { players: cached.players, origin: 'cache', cachedAt: cached.cachedAt }
    }
  }

  const players = await fetchSleeperPlayers()
  const cachedAt = new Date().toISOString()
  await mkdir(path.dirname(CACHE_PATH), { recursive: true })
  await writeFile(
    CACHE_PATH,
    `${JSON.stringify({ cachedAt, players }, null, 2)}\n`,
    'utf8'
  )

  return { players, origin: 'network', cachedAt }
}

/**
 * Match one model row (name, position, optional team) to a Sleeper player_id.
 * Returns { status, playerId, candidates } for match-report artifacts.
 */
export function matchSleeperPlayer({ playerName, position, team }, index) {
  const pool = []
  const seen = new Set()
  for (const key of vendorNameLookupKeys(playerName)) {
    for (const player of index.get(key) ?? []) {
      if (seen.has(player.player_id)) continue
      seen.add(player.player_id)
      pool.push(player)
    }
  }
  const acceptedPositions = new Set(sleeperPositionsFor(position))

  let candidates = pool.filter((player) => {
    const positions = [
      player.position,
      ...(player.fantasy_positions ?? []),
    ].filter(Boolean)
    return positions.some((code) => acceptedPositions.has(code))
  })

  if (candidates.length === 0) {
    return { status: 'unmatched', playerId: undefined, candidates: [] }
  }

  if (team) {
    const teamMatches = candidates.filter(
      (player) => player.team?.toUpperCase() === team.toUpperCase()
    )
    if (teamMatches.length === 1) {
      return {
        status: 'matched',
        playerId: teamMatches[0].player_id,
        candidates: teamMatches.map((p) => p.player_id),
      }
    }
    if (teamMatches.length > 1) {
      candidates = teamMatches
    }
    // Vendor team labels lag trades; still match when name+position is unique.
  }

  if (candidates.length === 1) {
    return {
      status: 'matched',
      playerId: candidates[0].player_id,
      candidates: [candidates[0].player_id],
    }
  }

  candidates.sort(
    (a, b) => (a.search_rank ?? 9999) - (b.search_rank ?? 9999)
  )

  return {
    status: 'ambiguous',
    playerId: candidates[0].player_id,
    candidates: candidates.map((p) => p.player_id),
  }
}
