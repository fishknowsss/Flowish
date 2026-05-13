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
  weekday: 'long',
})

export interface CalendarCell {
  dateKey: string
  day: number
  inCurrentMonth: boolean
}

export const getTodayKey = () => toDateKey(new Date())

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
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

export function daysUntil(dateKey: string) {
  const target = parseDateKey(dateKey)
  const today = parseDateKey(getTodayKey())
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export function getEventTypeLabel(type: EventItem['type']) {
  if (type === 'countdown') return '倒数日'
  if (type === 'countup') return '正数日'
  return '年纪日'
}

export function getAnnualOccurrenceDateKey(dateKey: string, baseDateKey = getTodayKey()) {
  const eventDate = parseDateKey(dateKey)
  const baseDate = parseDateKey(baseDateKey)
  const occurrence = new Date(baseDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 12)

  if (occurrence.getTime() < baseDate.getTime()) {
    occurrence.setFullYear(baseDate.getFullYear() + 1)
  }

  return toDateKey(occurrence)
}

export function getEventRelevantDateKey(event: EventItem, baseDateKey = getTodayKey()) {
  return event.type === 'annual' ? getAnnualOccurrenceDateKey(event.date, baseDateKey) : event.date
}

export function getEventDays(event: EventItem, baseDateKey = getTodayKey()) {
  const target = parseDateKey(getEventRelevantDateKey(event, baseDateKey))
  const baseDate = parseDateKey(baseDateKey)
  return Math.ceil((target.getTime() - baseDate.getTime()) / 86400000)
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
  return parseDateKey(a).getTime() - parseDateKey(b).getTime()
}

export function getDailySeed(dateKey: string, modulo: number) {
  const numeric = Number(dateKey.replaceAll('-', ''))
  return modulo === 0 ? 0 : numeric % modulo
}
