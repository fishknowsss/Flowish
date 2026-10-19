import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_DATA_VERSION, type AppData } from '../store/appData'
import {
  getBaseCalendarSignal,
  getHydratedCalendarSignal,
  getHydratedCalendarSignalMap,
} from './holidays'

const lunarMocks = vi.hoisted(() => ({
  fromYmd: vi.fn(),
  getHoliday: vi.fn(),
}))

vi.mock('lunar-javascript', () => ({
  Solar: { fromYmd: lunarMocks.fromYmd },
  HolidayUtil: { getHoliday: lunarMocks.getHoliday },
}))

const appData = (): AppData => ({
  version: APP_DATA_VERSION,
  focusTasks: [],
  backlogTasks: [],
  rituals: [
    {
      id: 'ritual',
      text: '复盘',
      active: true,
      completionHistory: { '2026-07-13': true },
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
  ],
  datePlans: {
    '2026-07-13': {
      date: '2026-07-13',
      note: '',
      tasks: [
        {
          id: 'task',
          text: '发布',
          completed: false,
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
          bucket: 'date',
          priority: null,
          timeSlot: null,
          dueDate: null,
        },
      ],
    },
  },
  events: [
    {
      id: 'event',
      title: '发布日',
      date: '2026-07-13',
      type: 'countdown',
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  ],
  quotes: [],
  preferences: {
    soundEnabled: false,
    theme: 'pearl',
    reducedMotion: false,
    quoteMode: 'daily',
    calendarExpandedDefault: false,
    lastActiveDate: '2026-07-13',
    pomodoro: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      roundsPerCycle: 4,
    },
  },
})

const workingSolar = () => ({
  getLunar: () => ({
    getJieQi: () => '小暑',
    getFestivals: () => ['六月节'],
  }),
})

describe('calendar signal hydration', () => {
  beforeEach(() => {
    lunarMocks.fromYmd.mockReset().mockImplementation(workingSolar)
    lunarMocks.getHoliday.mockReset().mockReturnValue({
      getName: () => '休息日',
      getTarget: () => '2026-07-13',
      isWork: () => false,
    })
  })

  it('projects focus tasks and backlog deadlines into synchronous calendar signals', () => {
    const data = appData()
    data.focusTasks = [{ ...data.datePlans['2026-07-13'].tasks[0], bucket: 'focus', timeSlot: 'morning' }]
    data.backlogTasks = [{
      ...data.datePlans['2026-07-13'].tasks[0],
      id: 'due-task',
      bucket: 'backlog',
      dueDate: '2026-07-13',
    }]

    expect(getBaseCalendarSignal('2026-07-13', data)).toMatchObject({
      focusTaskCount: 1,
      dueTaskCount: 1,
      dateTaskCount: 1,
    })
  })

  it('marks a makeup workday as work instead of repeating the holiday name', async () => {
    lunarMocks.getHoliday.mockReturnValue({
      getName: () => '春节',
      getTarget: () => '2026-02-17',
      isWork: () => true,
    })

    const signal = await getHydratedCalendarSignal('2026-02-14', appData())

    expect(signal.holidayStatus).toBe('workday')
    expect(signal.holidayName).toBeNull()
  })

  it('keeps fixed mainland holidays available beyond the official schedule table', async () => {
    lunarMocks.getHoliday.mockReturnValue(null)
    lunarMocks.fromYmd.mockReturnValue({
      getLunar: () => ({ getJieQi: () => '', getFestivals: () => [] }),
    })

    await expect(getHydratedCalendarSignal('2027-10-01', appData())).resolves.toMatchObject({
      holidayName: '国庆节',
      holidayStatus: null,
    })
  })

  it('falls back to synchronous signals after a calculation failure and succeeds on retry', async () => {
    const data = appData()
    const base = getBaseCalendarSignal('2026-07-13', data)
    lunarMocks.fromYmd.mockImplementationOnce(() => {
      throw new Error('temporary lunar failure')
    })

    await expect(getHydratedCalendarSignal('2026-07-13', data)).resolves.toEqual(base)
    await expect(getHydratedCalendarSignal('2026-07-13', data)).resolves.toEqual({
      ...base,
      holidayName: '休息日',
      holidayStatus: null,
      solarTerm: '小暑',
      lunarFestival: '六月节',
    })
  })

  it('falls back only the failed date when hydrating a calendar grid', async () => {
    const data = appData()
    lunarMocks.fromYmd.mockImplementation((_year: number, _month: number, day: number) => {
      if (day === 13) throw new Error('bad date')
      return workingSolar()
    })

    const signals = await getHydratedCalendarSignalMap(
      ['2026-07-13', '2026-07-14'],
      data,
    )

    expect(signals['2026-07-13']).toEqual(getBaseCalendarSignal('2026-07-13', data))
    expect(signals['2026-07-14']).toEqual({
      ...getBaseCalendarSignal('2026-07-14', data),
      holidayName: null,
      holidayStatus: 'dayOff',
      solarTerm: '小暑',
      lunarFestival: '六月节',
    })
  })
})
