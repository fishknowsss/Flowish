import { render, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { createEvent, createTask, defaultAppData } from '../store/appData'
import { CalendarWidget } from './CalendarWidget'

vi.mock('../lib/holidays', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/holidays')>()

  return {
    ...actual,
    getHydratedCalendarSignalMap: vi.fn(async (dateKeys: string[], appData: Parameters<typeof actual.getBaseCalendarSignal>[1]) =>
      Object.fromEntries(
        dateKeys.map((dateKey) => {
          const base = actual.getBaseCalendarSignal(dateKey, appData)
          if (dateKey === '2026-07-14') {
            return [
              dateKey,
              {
                ...base,
                holidayName: '同名节',
                lunarFestival: '同名节',
                solarTerm: '小暑',
                holidayStatus: 'dayOff' as const,
              },
            ]
          }
          if (dateKey === '2026-07-15') {
            return [dateKey, { ...base, holidayStatus: 'workday' as const }]
          }
          return [dateKey, base]
        }),
      ),
    ),
  }
})

describe('CalendarWidget agenda signals', () => {
  it('shows deduplicated calendar signals and derived agenda in compact and expanded views', async () => {
    const appData = defaultAppData('2026-07-14')
    appData.focusTasks = [
      createTask('撰写方案', 'focus', null, { timeSlot: 'morning' }),
    ]
    appData.backlogTasks = [
      createTask('提交报告', 'backlog', null, { dueDate: '2026-07-14' }),
    ]
    appData.datePlans['2026-07-14'] = {
      date: '2026-07-14',
      note: '',
      tasks: [createTask('预约复盘', 'date')],
    }
    appData.events = [createEvent('同名节', '2026-07-14')]
    appData.rituals = [
      {
        ...appData.rituals[0],
        completionHistory: { '2026-07-14': true },
      },
    ]

    const sharedProps = {
      viewDate: new Date(2026, 6, 1),
      selectedDate: '2026-07-14',
      todayKey: '2026-07-14',
      appData,
      onPrevMonth: vi.fn(),
      onNextMonth: vi.fn(),
      onToday: vi.fn(),
      onSelectDate: vi.fn(),
    }
    const { container } = render(
      <>
        <CalendarWidget {...sharedProps} variant="sidebar" />
        <CalendarWidget {...sharedProps} variant="stage" />
      </>,
    )
    const calendars = container.querySelectorAll<HTMLElement>('.calendar-panel')
    const compactDay = calendars[0].querySelector<HTMLButtonElement>('[data-date-key="2026-07-14"]')!
    const expandedDay = calendars[1].querySelector<HTMLButtonElement>('[data-date-key="2026-07-14"]')!

    await waitFor(() => expect(compactDay).toHaveAccessibleName(/小暑/))

    for (const day of [compactDay, expandedDay]) {
      const accessibleName = day.getAttribute('aria-label') ?? ''
      expect(accessibleName.match(/同名节/g)).toHaveLength(1)
      expect(accessibleName).toContain('小暑')
      expect(accessibleName).toContain('休')
      expect(accessibleName).toContain('1 重点')
      expect(accessibleName).toContain('1 截止')
      expect(accessibleName).toContain('1 安排')
      expect(accessibleName).toContain('重要')
      expect(accessibleName).toContain('节律')
      expect(within(day).getByText(/同名节/)).toBeInTheDocument()
    }

    const compactWorkday = calendars[0].querySelector<HTMLButtonElement>('[data-date-key="2026-07-15"]')!
    const expandedWorkday = calendars[1].querySelector<HTMLButtonElement>('[data-date-key="2026-07-15"]')!
    expect(compactWorkday).toHaveAccessibleName(/班/)
    expect(expandedWorkday).toHaveAccessibleName(/班/)

    expect(within(expandedDay).getByText('撰写方案')).toBeInTheDocument()
    expect(within(expandedDay).getByText('提交报告')).toBeInTheDocument()
    expect(within(expandedDay).getByText('预约复盘')).toBeInTheDocument()

    const selectedDetails = within(calendars[0]).getByRole('complementary', {
      name: '选中日期详情',
    })
    expect(within(selectedDetails).getByText('上午重点')).toBeInTheDocument()
    expect(within(selectedDetails).getByText('撰写方案')).toBeInTheDocument()
    expect(within(selectedDetails).getByText('截止')).toBeInTheDocument()
    expect(within(selectedDetails).getByText('提交报告')).toBeInTheDocument()
    expect(within(selectedDetails).getByText('安排')).toBeInTheDocument()
    expect(within(selectedDetails).getByText('预约复盘')).toBeInTheDocument()
    expect(within(selectedDetails).getByText(appData.rituals[0].text)).toBeInTheDocument()
    expect(within(selectedDetails).getAllByText('节律').length).toBeGreaterThan(0)
  })
})
