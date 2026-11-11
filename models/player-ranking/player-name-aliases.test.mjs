import { describe, expect, it } from 'vitest'

import {
  VENDOR_DISPLAY_NAME_ALIASES,
  vendorNameVariants,
} from './player-name-aliases.mjs'

describe('vendorNameVariants', () => {
  it('includes configured aliases after the vendor label', () => {
    for (const [vendor, aliases] of Object.entries(VENDOR_DISPLAY_NAME_ALIASES)) {
      expect(vendorNameVariants(vendor)).toEqual([vendor, ...aliases])
    }
  })

  it('returns only the vendor label when no alias exists', () => {
    expect(vendorNameVariants('Jonathan Taylor')).toEqual(['Jonathan Taylor'])
  })
})
