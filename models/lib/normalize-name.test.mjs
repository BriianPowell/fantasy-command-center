import { describe, expect, it } from 'vitest'

import {
  nameMatchKeys,
  normalizeName,
  stripGenerationalSuffix,
} from './normalize-name.mjs'

describe('stripGenerationalSuffix', () => {
  it('removes trailing generational markers', () => {
    expect(stripGenerationalSuffix('Patrick Mahomes II')).toBe('Patrick Mahomes')
    expect(stripGenerationalSuffix('Kevin Austin Jr.')).toBe('Kevin Austin')
    expect(stripGenerationalSuffix('Trent Sherfield Sr.')).toBe('Trent Sherfield')
    expect(stripGenerationalSuffix('Ray-Ray McCloud III')).toBe('Ray-Ray McCloud')
  })

  it('leaves names without a suffix unchanged', () => {
    expect(stripGenerationalSuffix('Jonathan Taylor')).toBe('Jonathan Taylor')
  })
})

describe('nameMatchKeys', () => {
  it('includes both full and suffix-stripped keys', () => {
    const keys = nameMatchKeys('Patrick Mahomes II')
    expect(keys).toContain(normalizeName('Patrick Mahomes II'))
    expect(keys).toContain(normalizeName('Patrick Mahomes'))
  })
})
