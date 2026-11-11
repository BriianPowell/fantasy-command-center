/**
 * Name normalization for cross-source player matching — keep in sync with
 * `normalizeName` in `src/strategy/teamOpportunity.ts`. Suffix stripping
 * (`stripGenerationalSuffix` / `nameMatchKeys`) is promote-specific; FantasyPros
 * often appends Jr./Sr./II while Sleeper often does not.
 */
export function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Drop trailing Jr./Sr./II/III/IV/V so vendor names align with Sleeper. */
export function stripGenerationalSuffix(name) {
  return name
    .trim()
    .replace(/\s+(?:Jr\.?|Sr\.?|II|III|IV|V)\.?$/i, '')
    .trim()
}

/** Normalized lookup keys to try when joining vendor names to Sleeper. */
export function nameMatchKeys(name) {
  const keys = new Set([normalizeName(name)])
  const stripped = stripGenerationalSuffix(name)
  if (stripped !== name) {
    keys.add(normalizeName(stripped))
  }
  return [...keys]
}
