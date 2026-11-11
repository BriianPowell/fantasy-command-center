/**
 * FantasyPros / vendor display names that differ from Sleeper's master list.
 * Each entry is exact vendor `playerName` → alternate full names to index under.
 * Keep this small and evidence-backed (promote match report + Sleeper lookup).
 */
export const VENDOR_DISPLAY_NAME_ALIASES = {
  'Hollywood Brown': ['Marquise Brown'],
  'Bam Knight': ['Zonovan Knight'],
  'Mitchell Tinsley': ['Mitch Tinsley'],
}

/** Every vendor label to try when resolving a Sleeper player id. */
export function vendorNameVariants(playerName) {
  const variants = [playerName]
  const aliases = VENDOR_DISPLAY_NAME_ALIASES[playerName]
  if (aliases) {
    variants.push(...aliases)
  }
  return variants
}
