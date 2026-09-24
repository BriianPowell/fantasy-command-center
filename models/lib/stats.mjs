/**
 * Shared math for the offline model.
 *
 * Scores are built from ordinal percentile ranks rather than z-scores: a
 * single runaway season (a 2,000-yard rusher, a 60-sack defense) would
 * stretch a standard deviation and squash everyone else, while a rank is
 * unaffected by how far the outlier ran away.
 */

export function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

export function mean(values) {
  return values.length === 0 ? 0 : sum(values) / values.length
}

/**
 * Map values onto 0-100 by rank, worst to best, averaging ties.
 *
 * The lowest value scores 0 and the highest 100, so a season's teams
 * always span the full scale and are comparable across seasons.
 */
export function percentileScores(values) {
  const n = values.length
  if (n === 0) return []
  if (n === 1) return [50]

  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)
  const scores = new Array(n)

  let start = 0
  while (start < n) {
    let end = start
    while (end + 1 < n && order[end + 1].value === order[start].value) end += 1

    const score = ((start + end) / 2 / (n - 1)) * 100
    for (let i = start; i <= end; i += 1) scores[order[i].index] = score
    start = end + 1
  }

  return scores
}

/** Same as `percentileScores`, but for metrics where lower is better. */
export function invertedPercentileScores(values) {
  return percentileScores(values).map((score) => 100 - score)
}

/** Dense ranks, 1 = highest value. Ties share the better rank. */
export function ranksDescending(values) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
  const ranks = new Array(values.length)

  let start = 0
  while (start < order.length) {
    let end = start
    while (
      end + 1 < order.length &&
      order[end + 1].value === order[start].value
    )
      end += 1
    for (let i = start; i <= end; i += 1) ranks[order[i].index] = start + 1
    start = end + 1
  }

  return ranks
}

/** Pearson correlation. Returns 0 when either series has no variance. */
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0

  const meanX = mean(xs.slice(0, n))
  const meanY = mean(ys.slice(0, n))

  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }

  const denominator = Math.sqrt(varianceX * varianceY)
  return denominator === 0 ? 0 : covariance / denominator
}

/** Ordinary least squares fit of `ys` on `xs`. */
export function linearRegression(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  const r = pearson(xs, ys)
  if (n < 2) return { intercept: 0, n, r: 0, r2: 0, slope: 0 }

  const meanX = mean(xs.slice(0, n))
  const meanY = mean(ys.slice(0, n))

  let covariance = 0
  let varianceX = 0
  for (let i = 0; i < n; i += 1) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY)
    varianceX += (xs[i] - meanX) ** 2
  }

  const slope = varianceX === 0 ? 0 : covariance / varianceX
  return { intercept: meanY - slope * meanX, n, r, r2: r * r, slope }
}

/** Average absolute miss between paired actual and predicted values. */
export function meanAbsoluteError(actual, predicted) {
  const n = Math.min(actual.length, predicted.length)
  if (n === 0) return 0
  let total = 0
  for (let i = 0; i < n; i += 1) total += Math.abs(actual[i] - predicted[i])
  return total / n
}

/** Round to a fixed number of decimals, for artifact readability. */
export function round(value, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
