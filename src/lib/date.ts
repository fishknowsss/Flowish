import type { EventItem } from '../store/appData'

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' })
const shortDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
})
const longDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
const topbarDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MILLISECONDS_PER_DAY = 86_400_000

interface DateKeyParts {
  year: number
  month: number
  day: number
}

export interface CalendarCell {
  dateKey: string
  day: number
  inCurrentMonth: boolean
}

export const getTodayKey = () => toDateKey(new Date())

function getDateKeyParts(dateKey: string): DateKeyParts | null {
  const match = DATE_KEY_PATTERN.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null

  return { year, month, day }
}

function requireDateKeyParts(dateKey: string): DateKeyParts {
  const parts = getDateKeyParts(dateKey)
  if (!parts) {
    throw new RangeError(`无效日期：${dateKey}`)
  }
  return parts
}

function formatDateKey({ year, month, day }: DateKeyParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && getDateKeyParts(value) !== null
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(dateKey: string): Date {
  const { year, month, day } = requireDateKeyParts(dateKey)
  return new Date(year, month - 1, day, 12)
}

function getDateOrdinal(dateKey: string): number {
  const { year, month, day } = requireDateKeyParts(dateKey)
  return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY)
}

export function differenceInCalendarDays(targetDateKey: string, baseDateKey: string): number {
  return getDateOrdinal(targetDateKey) - getDateOrdinal(baseDateKey)
}

export function formatTopbarDate(dateKey: string) {
  return topbarDateFormatter.format(parseDateKey(dateKey))
}

export function formatWeekday(dateKey: string) {
  return weekdayFormatter.format(parseDateKey(dateKey))
}

export function formatShortDate(dateKey: string) {
  return shortDateFormatter.format(parseDateKey(dateKey))
}

export function formatLongDate(dateKey: string) {
  return longDateFormatter.format(parseDateKey(dateKey))
}

export function getMonthLabel(date: Date) {
  return `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function buildCalendarGrid(viewDate: Date): CalendarCell[] {
  const firstDay = startOfMonth(viewDate)
  const offset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart)
    cellDate.setDate(gridStart.getDate() + index)
    return {
      dateKey: toDateKey(cellDate),
      day: cellDate.getDate(),
      inCurrentMonth: cellDate.getMonth() === viewDate.getMonth(),
    }
  })
}

export function daysUntil(dateKey: string, baseDateKey = getTodayKey()) {
  return differenceInCalendarDays(dateKey, baseDateKey)
}

export function getEventTypeLabel(type: EventItem['type']) {
  if (type === 'countdown') return '倒数日'
  if (type === 'countup') return '累计日'
  return '每年'
}

export function getAnnualOccurrenceDateKey(dateKey: string, baseDateKey = getTodayKey()) {
  const eventDate = requireDateKeyParts(dateKey)
  const baseDate = requireDateKeyParts(baseDateKey)
  let occurrenceYear = baseDate.year

  if (eventDate.month === 2 && eventDate.day === 29) {
    while (!isLeapYear(occurrenceYear)) {
      occurrenceYear += 1
    }
  }

  let occurrence = formatDateKey({
    year: occurrenceYear,
    month: eventDate.month,
    day: eventDate.day,
  })

  if (differenceInCalendarDays(occurrence, baseDateKey) < 0) {
    occurrenceYear += 1
    if (eventDate.month === 2 && eventDate.day === 29) {
      while (!isLeapYear(occurrenceYear)) {
        occurrenceYear += 1
      }
    }
    occurrence = formatDateKey({
      year: occurrenceYear,
      month: eventDate.month,
      day: eventDate.day,
    })
  }

  return occurrence
}

export function getEventRelevantDateKey(event: EventItem, baseDateKey = getTodayKey()) {
  return event.type === 'annual' ? getAnnualOccurrenceDateKey(event.date, baseDateKey) : event.date
}

export function eventOccursOnDate(event: EventItem, dateKey: string): boolean {
  requireDateKeyParts(dateKey)
  if (event.type !== 'annual') return event.date === dateKey

  const eventDate = requireDateKeyParts(event.date)
  const occurrenceDate = requireDateKeyParts(dateKey)
  return eventDate.month === occurrenceDate.month && eventDate.day === occurrenceDate.day
}

export function getEventDays(event: EventItem, baseDateKey = getTodayKey()) {
  return differenceInCalendarDays(getEventRelevantDateKey(event, baseDateKey), baseDateKey)
}

export function getEventDayCopy(event: EventItem, baseDateKey = getTodayKey()) {
  const days = getEventDays(event, baseDateKey)

  if (event.type === 'countup') {
    if (days > 0) {
      return {
        value: `${days}`,
        unit: '天后',
        phrase: `${days} 天后开始`,
      }
    }

    const elapsed = Math.abs(days)
    return {
      value: elapsed === 0 ? '今天' : `${elapsed}`,
      unit: elapsed === 0 ? '' : '天',
      phrase: elapsed === 0 ? '今天开始' : `已开始 ${elapsed} 天`,
    }
  }

  if (days === 0) {
    return {
      value: '今天',
      unit: '',
      phrase: event.type === 'annual' ? '今天' : '今天到期',
    }
  }

  return {
    value: `${Math.abs(days)}`,
    unit: days > 0 ? '天后' : '天前',
    phrase: days > 0 ? `${days} 天后` : `已过 ${Math.abs(days)} 天`,
  }
}

export function compareDateKeys(a: string, b: string) {
  return differenceInCalendarDays(a, b)
}

export function getDailySeed(dateKey: string, modulo: number) {
  const numeric = Number(dateKey.replaceAll('-', ''))
  return modulo === 0 ? 0 : numeric % modulo
}
