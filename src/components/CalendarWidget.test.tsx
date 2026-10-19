import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { defaultAppData } from '../store/appData'
import { CalendarWidget } from './CalendarWidget'

describe('CalendarWidget keyboard navigation', () => {
  it('keeps one day in the tab order and moves by arrow key', () => {
    const onSelectDate = vi.fn()
    const { container } = render(
      <CalendarWidget
        viewDate={new Date(2026, 6, 1)}
        selectedDate="2026-07-13"
        todayKey="2026-07-13"
        appData={defaultAppData('2026-07-13')}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
        onSelectDate={onSelectDate}
      />,
    )
    const days = [...container.querySelectorAll<HTMLButtonElement>('.calendar-day')]

    expect(days.filter((day) => day.tabIndex === 0)).toHaveLength(1)
    const selected = days.find((day) => day.dataset.dateKey === '2026-07-13')
    expect(selected).toBeDefined()
    fireEvent.keyDown(selected!, { key: 'ArrowRight' })
    expect(onSelectDate).toHaveBeenCalledWith('2026-07-14')
  })

  it('offers a direct return-to-today action in compact and expanded calendars', () => {
    const onToday = vi.fn()
    const sharedProps = {
      viewDate: new Date(2026, 6, 1),
      selectedDate: '2026-07-13',
      todayKey: '2026-07-14',
      appData: defaultAppData('2026-07-14'),
      onPrevMonth: vi.fn(),
      onNextMonth: vi.fn(),
      onToday,
      onSelectDate: vi.fn(),
    }

    render(
      <>
        <CalendarWidget {...sharedProps} variant="sidebar" />
        <CalendarWidget {...sharedProps} variant="stage" />
      </>,
    )

    screen.getAllByRole('button', { name: '回到今天' }).forEach((button) => {
      fireEvent.click(button)
    })
    expect(onToday).toHaveBeenCalledTimes(2)
  })

  it('keeps keyboard focus inside the active calendar when two calendars are mounted', async () => {
    const appData = defaultAppData('2026-07-13')
    const sharedProps = {
      viewDate: new Date(2026, 6, 1),
      selectedDate: '2026-07-13',
      todayKey: '2026-07-13',
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
    const stageSelected = calendars[1].querySelector<HTMLButtonElement>('[data-date-key="2026-07-13"]')
    const stageNext = calendars[1].querySelector<HTMLButtonElement>('[data-date-key="2026-07-14"]')

    stageSelected?.focus()
    fireEvent.keyDown(stageSelected!, { key: 'ArrowRight' })

    await waitFor(() => expect(stageNext).toHaveFocus())
  })
})
