import type { AppData, EventItem, Ritual } from '../store/appData'

import { getCalendarAgendaForDate } from './calendarAgenda'

export interface CalendarSignal {
  holidayName: string | null
  holidayStatus: 'dayOff' | 'workday' | null
  solarTerm: string | null
  lunarFestival: string | null
  isWeekend: boolean
  hasDateTasks: boolean
  hasEvents: boolean
  hasRitualCompletion: boolean
  focusTaskCount: number
  dueTaskCount: number
  dateTaskCount: number
}

type LunarModule = typeof import('lunar-javascript')

let lunarModulePromise: Promise<LunarModule> | null = null

const COMMON_SOLAR_HOLIDAYS: Readonly<Record<string, string>> = {
  '01-01': '元旦',
  '05-01': '劳动节',
  '10-01': '国庆节',
}

function getLunarModule() {
  if (!lunarModulePromise) {
    lunarModulePromise = import('lunar-javascript').catch((error: unknown) => {
      lunarModulePromise = null
      throw error
    })
  }

  return lunarModulePromise
}

function hydrateCalendarSignal(
  dateKey: string,
  base: CalendarSignal,
  { HolidayUtil, Solar }: LunarModule,
): CalendarSignal {
  const [year, month, day] = dateKey.split('-').map(Number)
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const jieQi = lunar.getJieQi()
  const festivals = lunar.getFestivals()
  const holiday = HolidayUtil.getHoliday(year, month, day)
  let holidayName = COMMON_SOLAR_HOLIDAYS[dateKey.slice(5)] ?? null
  let holidayStatus: CalendarSignal['holidayStatus'] = null

  if (holiday) {
    if (holiday.isWork()) {
      holidayStatus = 'workday'
    } else if (holiday.getTarget() !== dateKey) {
      holidayStatus = 'dayOff'
    } else {
      holidayName = holiday.getName()
    }
  }

  return {
    ...base,
    holidayName,
    holidayStatus,
    solarTerm: typeof jieQi === 'string' ? jieQi : jieQi?.getName() ?? null,
    lunarFestival: festivals[0] ?? null,
  }
}

export function getBaseCalendarSignal(dateKey: string, appData: AppData): CalendarSignal {
  const [year, month, day] = dateKey.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()
  const agenda = getCalendarAgendaForDate(
    appData,
    dateKey,
    appData.preferences.lastActiveDate,
  )
  const focusTaskCount = agenda.filter((item) => item.source === 'focus').length
  const dueTaskCount = agenda.filter((item) => item.source === 'backlog').length
  const dateTaskCount = agenda.filter((item) => item.source === 'datePlan').length

  return {
    holidayName: COMMON_SOLAR_HOLIDAYS[dateKey.slice(5)] ?? null,
    holidayStatus: null,
    solarTerm: null,
    lunarFestival: null,
    isWeekend: weekday === 0 || weekday === 6,
    hasDateTasks: dateTaskCount > 0,
    hasEvents: appData.events.some((event) => isEventOnDate(event, dateKey)),
    hasRitualCompletion: appData.rituals.some((ritual) => Boolean(ritual.completionHistory[dateKey])),
    focusTaskCount,
    dueTaskCount,
    dateTaskCount,
  }
}

export async function getHydratedCalendarSignal(
  dateKey: string,
  appData: AppData,
): Promise<CalendarSignal> {
  const base = getBaseCalendarSignal(dateKey, appData)
  try {
    return hydrateCalendarSignal(dateKey, base, await getLunarModule())
  } catch {
    return base
  }
}

export async function getHydratedCalendarSignalMap(
  dateKeys: string[],
  appData: AppData,
): Promise<Record<string, CalendarSignal>> {
  const baseSignals = Object.fromEntries(
    dateKeys.map((dateKey) => [dateKey, getBaseCalendarSignal(dateKey, appData)]),
  )

  let lunarModule: LunarModule
  try {
    lunarModule = await getLunarModule()
  } catch {
    return baseSignals
  }

  return Object.fromEntries(
    dateKeys.map((dateKey) => {
      const base = baseSignals[dateKey]
      try {
        return [dateKey, hydrateCalendarSignal(dateKey, base, lunarModule)]
      } catch {
        return [dateKey, base]
      }
    }),
  )
}

function isEventOnDate(event: EventItem, dateKey: string) {
  if (event.date === dateKey) return true
  if (event.type !== 'annual') return false
  return event.date.slice(5) === dateKey.slice(5)
}

export function getRitualCompletionCount(rituals: Ritual[], dateKey: string) {
  return rituals.filter((ritual) => Boolean(ritual.completionHistory[dateKey])).length
}
