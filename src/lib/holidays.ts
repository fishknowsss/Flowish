import type { AppData, EventItem, Ritual } from '../store/appData'

import { compareDateKeys } from './date'

export interface CalendarSignal {
  holidayName: string | null
  solarTerm: string | null
  lunarFestival: string | null
  isWeekend: boolean
  hasDateTasks: boolean
  hasEvents: boolean
  hasRitualCompletion: boolean
}

type LunarModule = typeof import('lunar-javascript')

let lunarModulePromise: Promise<LunarModule> | null = null

function getLunarModule() {
  if (!lunarModulePromise) {
    lunarModulePromise = import('lunar-javascript')
  }

  return lunarModulePromise
}

export function getBaseCalendarSignal(dateKey: string, appData: AppData): CalendarSignal {
  const [year, month, day] = dateKey.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()

  return {
    holidayName: null,
    solarTerm: null,
    lunarFestival: null,
    isWeekend: weekday === 0 || weekday === 6,
    hasDateTasks: (appData.datePlans[dateKey]?.tasks.length ?? 0) > 0,
    hasEvents: appData.events.some((event) => isEventOnDate(event, dateKey)),
    hasRitualCompletion: appData.rituals.some((ritual) => Boolean(ritual.completionHistory[dateKey])),
  }
}

export async function getHydratedCalendarSignal(
  dateKey: string,
  appData: AppData,
): Promise<CalendarSignal> {
  const base = getBaseCalendarSignal(dateKey, appData)
  const [year, month, day] = dateKey.split('-').map(Number)
  const { HolidayUtil, Solar } = await getLunarModule()
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const jieQi = lunar.getJieQi()
  const festivals = lunar.getFestivals()
  const holiday = HolidayUtil.getHoliday(year, month, day)

  return {
    ...base,
    holidayName: holiday?.getName() ?? null,
    solarTerm: typeof jieQi === 'string' ? jieQi : jieQi?.getName() ?? null,
    lunarFestival: festivals[0] ?? null,
  }
}

export async function getHydratedCalendarSignalMap(
  dateKeys: string[],
  appData: AppData,
): Promise<Record<string, CalendarSignal>> {
  const { HolidayUtil, Solar } = await getLunarModule()

  return Object.fromEntries(
    dateKeys.map((dateKey) => {
      const [year, month, day] = dateKey.split('-').map(Number)
      const base = getBaseCalendarSignal(dateKey, appData)
      const solar = Solar.fromYmd(year, month, day)
      const lunar = solar.getLunar()
      const jieQi = lunar.getJieQi()
      const festivals = lunar.getFestivals()
      const holiday = HolidayUtil.getHoliday(year, month, day)

      return [
        dateKey,
        {
          ...base,
          holidayName: holiday?.getName() ?? null,
          solarTerm: typeof jieQi === 'string' ? jieQi : jieQi?.getName() ?? null,
          lunarFestival: festivals[0] ?? null,
        } satisfies CalendarSignal,
      ]
    }),
  )
}

export function getEventsForDate(events: EventItem[], dateKey: string) {
  return events
    .filter((event) => isEventOnDate(event, dateKey))
    .sort((left, right) => compareDateKeys(left.date, right.date))
}

function isEventOnDate(event: EventItem, dateKey: string) {
  if (event.date === dateKey) return true
  if (event.type !== 'annual') return false
  return event.date.slice(5) === dateKey.slice(5)
}

export function getRitualCompletionCount(rituals: Ritual[], dateKey: string) {
  return rituals.filter((ritual) => Boolean(ritual.completionHistory[dateKey])).length
}
