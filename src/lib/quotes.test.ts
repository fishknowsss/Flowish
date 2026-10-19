import { describe, expect, it } from 'vitest'

import { BUILTIN_QUOTES } from './quotes'

describe('builtin quote catalog', () => {
  it('provides a substantial, well-formed catalog with stable unique ids', () => {
    const ids = BUILTIN_QUOTES.map((quote) => quote.id)

    expect(BUILTIN_QUOTES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(ids).size).toBe(ids.length)
    expect(
      BUILTIN_QUOTES.every(
        (quote) =>
          quote.id.trim().length > 0 &&
          quote.text.trim().length > 0 &&
          quote.author.trim().length > 0 &&
          quote.source === 'builtin',
      ),
    ).toBe(true)
  })
})
