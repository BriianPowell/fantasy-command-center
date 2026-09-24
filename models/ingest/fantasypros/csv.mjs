/**
 * CSV primitives for the FantasyPros exports.
 *
 * The Statistics reports quote every field; the Advanced Stats reports quote
 * nothing and separate the player's name from the team with runs of spaces.
 * Both shapes go through the same reader.
 */

/** Split one CSV line, honouring quoted fields and escaped `""` quotes. */
export function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)
  return cells.map((value) => value.trim())
}

/**
 * Parse a whole file into rows, dropping any leading BOM and empty rows.
 *
 * Emptiness is judged after parsing, not before: these exports end with two
 * `""` lines, which a raw blank-line filter would keep and then count as
 * data.
 */
export function parseCsvRows(contents) {
  return contents
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(parseCsvLine)
    .filter((cells) => cells.some((cell) => cell.length > 0))
}

/**
 * Pull the name and team out of a player cell.
 *
 * Statistics reports use `Josh Allen (BUF)`; Advanced reports use
 * `Josh Allen   BUF`. Team is absent for the handful of rows where
 * FantasyPros has no team on file.
 */
export function parsePlayerField(raw) {
  const parenthesised = raw.match(/^(.*)\s\(([A-Z]{2,4})\)$/)
  if (parenthesised) {
    return { name: parenthesised[1].trim(), team: parenthesised[2] }
  }

  const spaced = raw.match(/^(.*?)\s{2,}([A-Z]{2,4})$/)
  if (spaced) {
    return { name: spaced[1].trim(), team: spaced[2] }
  }

  return { name: raw.trim(), team: undefined }
}

/** Numbers arrive with `%` and thousands separators; `-` means "no value". */
export function toNumber(value) {
  if (value === undefined || value === '' || value === '-') return undefined
  const num = Number(value.replace(/[%,]/g, ''))
  return Number.isFinite(num) ? num : undefined
}
