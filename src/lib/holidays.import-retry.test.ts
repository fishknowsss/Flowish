import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultAppData } from '../store/appData'

describe('lunar module loading', () => {
  afterEach(() => {
    vi.doUnmock('lunar-javascript')
    vi.resetModules()
  })

  it('returns base signals after an import failure and retries on the next request', async () => {
    let importAttempts = 0
    vi.doMock('lunar-javascript', () => {
      importAttempts += 1
      if (importAttempts === 1) throw new Error('temporary chunk failure')

      return {
        Solar: {
          fromYmd: () => ({
            getLunar: () => ({
              getJieQi: () => '立秋',
              getFestivals: () => ['七夕'],
            }),
          }),
        },
        HolidayUtil: {
          getHoliday: () => ({
            getName: () => '休息日',
            getTarget: () => '2026-08-01',
            isWork: () => false,
          }),
        },
      }
    })

    const holidays = await import('./holidays')
    const data = defaultAppData('2026-08-01')
    const base = holidays.getBaseCalendarSignal('2026-08-01', data)

    await expect(holidays.getHydratedCalendarSignal('2026-08-01', data)).resolves.toEqual(base)
    const secondSignal = await holidays.getHydratedCalendarSignal('2026-08-01', data)
    expect(importAttempts).toBe(2)
    expect(secondSignal).toEqual({
      ...base,
      holidayName: '休息日',
      solarTerm: '立秋',
      lunarFestival: '七夕',
    })
  })
})
