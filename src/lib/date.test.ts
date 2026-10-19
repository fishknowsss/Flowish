import { describe, expect, it } from 'vitest'

import type { EventItem } from '../store/appData'
import {
  differenceInCalendarDays,
  eventOccursOnDate,
  getAnnualOccurrenceDateKey,
  getEventDays,
  isDateKey,
} from './date'

const annualEvent = (date: string): EventItem => ({
  id: 'annual_test',
  title: '纪念日',
  date,
  type: 'annual',
  createdAt: '2026-01-01T00:00:00.000Z',
})

describe('calendar-day arithmetic', () => {
  it('counts adjacent calendar dates as one day across a 25-hour DST boundary', () => {
    expect(differenceInCalendarDays('2026-11-01', '2026-10-31')).toBe(1)
  })

  it('validates real Gregorian dates', () => {
    expect(isDateKey('2028-02-29')).toBe(true)
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
  })
})

describe('annual events', () => {
  it('uses the same-day occurrence when the anniversary is today', () => {
    expect(getAnnualOccurrenceDateKey('2020-07-13', '2026-07-13')).toBe('2026-07-13')
    expect(getEventDays(annualEvent('2020-07-13'), '2026-07-13')).toBe(0)
  })

  it('uses the next year after this year occurrence has passed', () => {
    expect(getAnnualOccurrenceDateKey('2020-07-13', '2026-07-14')).toBe('2027-07-13')
  })

  it('keeps February 29 anniversaries on the next real leap day', () => {
    expect(getAnnualOccurrenceDateKey('2024-02-29', '2026-01-01')).toBe('2028-02-29')
    expect(getAnnualOccurrenceDateKey('2024-02-29', '2028-02-29')).toBe('2028-02-29')
    expect(getAnnualOccurrenceDateKey('2024-02-29', '2028-03-01')).toBe('2032-02-29')
  })

  it('matches annual events by their actual occurrence date', () => {
    expect(eventOccursOnDate(annualEvent('2020-07-13'), '2026-07-13')).toBe(true)
    expect(eventOccursOnDate(annualEvent('2024-02-29'), '2026-03-01')).toBe(false)
    expect(eventOccursOnDate(annualEvent('2024-02-29'), '2028-02-29')).toBe(true)
  })
})
