import { describe, expect, it } from 'vitest'

import {
  invertedPercentileScores,
  linearRegression,
  mean,
  meanAbsoluteError,
  pearson,
  percentileScores,
  ranksDescending,
  round,
  sum,
} from './stats.mjs'

describe('percentileScores', () => {
  it('spans the full 0-100 range', () => {
    expect(percentileScores([10, 20, 30, 40, 50])).toEqual([0, 25, 50, 75, 100])
  })

  it('scores by rank, not distance, so an outlier cannot squash the field', () => {
    const tight = percentileScores([1, 2, 3, 4])
    const skewed = percentileScores([1, 2, 3, 10000])
    expect(skewed).toEqual(tight)
  })

  it('averages ties', () => {
    expect(percentileScores([5, 5, 9])).toEqual([25, 25, 100])
  })

  it('handles degenerate inputs', () => {
    expect(percentileScores([])).toEqual([])
    expect(percentileScores([7])).toEqual([50])
    expect(percentileScores([4, 4, 4])).toEqual([50, 50, 50])
  })
})

describe('invertedPercentileScores', () => {
  it('rewards the lowest value', () => {
    expect(invertedPercentileScores([10, 20, 30])).toEqual([100, 50, 0])
  })
})

describe('ranksDescending', () => {
  it('ranks the highest value first', () => {
    expect(ranksDescending([10, 30, 20])).toEqual([3, 1, 2])
  })

  it('gives ties the better rank and skips the next', () => {
    expect(ranksDescending([50, 50, 10])).toEqual([1, 1, 3])
  })
})

describe('pearson', () => {
  it('returns 1 for a perfect positive relationship', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10)
  })

  it('returns -1 for a perfect inverse relationship', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10)
  })

  it('returns 0 when a series has no variance', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0)
  })

  it('returns 0 for fewer than two points', () => {
    expect(pearson([1], [2])).toBe(0)
  })
})

describe('linearRegression', () => {
  it('recovers the generating slope and intercept', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = xs.map((x) => 3 * x + 7)
    const fit = linearRegression(xs, ys)

    expect(fit.slope).toBeCloseTo(3, 10)
    expect(fit.intercept).toBeCloseTo(7, 10)
    expect(fit.r2).toBeCloseTo(1, 10)
    expect(fit.n).toBe(5)
  })

  it('reports a weaker fit for noisy data', () => {
    const fit = linearRegression([1, 2, 3, 4], [2, 1, 4, 3])
    expect(fit.r2).toBeGreaterThan(0)
    expect(fit.r2).toBeLessThan(1)
  })

  it('returns a flat line when x has no variance', () => {
    expect(linearRegression([2, 2, 2], [1, 2, 3]).slope).toBe(0)
  })
})

describe('meanAbsoluteError', () => {
  it('averages the absolute misses', () => {
    expect(meanAbsoluteError([10, 20, 30], [12, 18, 30])).toBeCloseTo(4 / 3, 10)
  })

  it('is 0 for empty input', () => {
    expect(meanAbsoluteError([], [])).toBe(0)
  })
})

describe('sum, mean, round', () => {
  it('sums and averages', () => {
    expect(sum([1, 2, 3])).toBe(6)
    expect(mean([1, 2, 3])).toBe(2)
  })

  it('treats an empty average as 0 rather than NaN', () => {
    expect(mean([])).toBe(0)
  })

  it('rounds to the requested precision', () => {
    expect(round(12.345)).toBe(12.3)
    expect(round(12.345, 2)).toBe(12.35)
    expect(round(-0.04)).toBe(-0)
  })
})
