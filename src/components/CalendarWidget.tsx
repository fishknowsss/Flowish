import { useEffect, useMemo, useRef, useState } from 'react'

import {
  addMonths,
  buildCalendarGrid,
  formatLongDate,
  getMonthLabel,
  parseDateKey,
  toDateKey,
} from '../lib/date'
import {
  getCalendarAgendaForDate,
  type CalendarAgendaItem,
} from '../lib/calendarAgenda'
import {
  getBaseCalendarSignal,
  getHydratedCalendarSignalMap,
  type CalendarSignal,
} from '../lib/holidays'
import type { AppData } from '../store/appData'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ExpandIcon, NoteIcon } from './Icon'

interface CalendarWidgetProps {
  viewDate: Date
  selectedDate: string
  todayKey: string
  appData: AppData
  variant?: 'sidebar' | 'stage'
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDate: (dateKey: string) => void
  onOpenStage?: () => void
  onOpenPlanner?: () => void
}

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

function shiftDateByDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function shiftDateByMonths(dateKey: string, months: number) {
  const source = parseDateKey(dateKey)
  const target = addMonths(source, months)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(source.getDate(), lastDay))
  return toDateKey(target)
}

type SignalLabel = {
  text: string
  tone: 'warm' | 'green' | 'blue' | 'neutral'
}

function getSignalLabels(signal: CalendarSignal): SignalLabel[] {
  const candidates: Array<SignalLabel | null> = [
    signal.holidayName ? { text: signal.holidayName, tone: 'warm' } : null,
    signal.lunarFestival ? { text: signal.lunarFestival, tone: 'green' } : null,
    signal.solarTerm ? { text: signal.solarTerm, tone: 'green' } : null,
    signal.holidayStatus === 'dayOff' ? { text: '休', tone: 'warm' } : null,
    signal.holidayStatus === 'workday' ? { text: '班', tone: 'neutral' } : null,
    signal.focusTaskCount > 0
      ? { text: `${signal.focusTaskCount} 重点`, tone: 'blue' }
      : null,
    signal.dueTaskCount > 0 ? { text: `${signal.dueTaskCount} 截止`, tone: 'warm' } : null,
    signal.dateTaskCount > 0 ? { text: `${signal.dateTaskCount} 安排`, tone: 'blue' } : null,
    signal.hasEvents ? { text: '重要', tone: 'warm' } : null,
    signal.hasRitualCompletion ? { text: '节律', tone: 'green' } : null,
  ]
  const seen = new Set<string>()

  return candidates.filter((label): label is SignalLabel => {
    if (!label) return false
    const normalized = label.text.trim()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function getCompactSignalLabel(signal: CalendarSignal): SignalLabel | null {
  const candidates: Array<SignalLabel | null> = [
    signal.holidayName ? { text: signal.holidayName, tone: 'warm' } : null,
    signal.lunarFestival ? { text: signal.lunarFestival, tone: 'green' } : null,
    signal.solarTerm ? { text: signal.solarTerm, tone: 'green' } : null,
    signal.holidayStatus === 'dayOff' ? { text: '休', tone: 'warm' } : null,
    signal.holidayStatus === 'workday' ? { text: '班', tone: 'neutral' } : null,
  ]

  return candidates.find((label): label is SignalLabel => label !== null) ?? null
}

function getUniqueAgendaItems(
  agenda: CalendarAgendaItem[],
  excludedTexts: string[] = [],
): CalendarAgendaItem[] {
  const seen = new Set(excludedTexts.map((text) => text.trim()).filter(Boolean))

  return agenda.filter((item) => {
    const normalized = item.text.trim()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

const focusTimeSlotLabels = {
  morning: '上午重点',
  afternoon: '下午重点',
  evening: '晚上重点',
  lateNight: '深夜重点',
} as const

function getAgendaContextLabel(item: CalendarAgendaItem) {
  if (item.source === 'focus') {
    return item.timeSlot ? focusTimeSlotLabels[item.timeSlot] : '今日重点'
  }
  if (item.source === 'backlog') return '截止'
  if (item.source === 'datePlan') return '安排'
  if (item.source === 'event') return '重要'
  return '节律'
}

function getAgendaTone(item: CalendarAgendaItem) {
  if (item.source === 'backlog' || item.source === 'event') return 'warm'
  if (item.source === 'ritual') return 'green'
  return 'blue'
}

export function CalendarWidget({
  viewDate,
  selectedDate,
  todayKey,
  appData,
  variant = 'sidebar',
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  onOpenStage,
  onOpenPlanner,
}: CalendarWidgetProps) {
  const calendarRef = useRef<HTMLElement | null>(null)
  const cells = useMemo(() => buildCalendarGrid(viewDate), [viewDate])
  const [signalMap, setSignalMap] = useState<Record<string, CalendarSignal>>({})

  const baseSignalMap = useMemo(
    () =>
      Object.fromEntries(
        cells.map((cell) => [cell.dateKey, getBaseCalendarSignal(cell.dateKey, appData)]),
      ),
    [appData, cells],
  )
  const agendaMap = useMemo(
    () =>
      Object.fromEntries(
        cells.map((cell) => [
          cell.dateKey,
          getCalendarAgendaForDate(appData, cell.dateKey, todayKey),
        ]),
      ),
    [appData, cells, todayKey],
  )

  useEffect(() => {
    let active = true
    void getHydratedCalendarSignalMap(
      cells.map((cell) => cell.dateKey),
      appData,
    ).then((nextSignals) => {
      if (active) setSignalMap(nextSignals)
    })

    return () => {
      active = false
    }
  }, [appData, cells])

  const handleDayClick = (dateKey: string) => {
    onSelectDate(dateKey)
  }

  const focusDate = (dateKey: string) => {
    onSelectDate(dateKey)
    requestAnimationFrame(() => {
      calendarRef.current
        ?.querySelector<HTMLButtonElement>(`.calendar-day[data-date-key="${CSS.escape(dateKey)}"]`)
        ?.focus()
    })
  }

  const selectedDateVisible = cells.some((cell) => cell.dateKey === selectedDate)
  const rovingDateKey = selectedDateVisible
    ? selectedDate
    : (cells.find((cell) => cell.inCurrentMonth)?.dateKey ?? cells[0]?.dateKey)

  const selectedSignal =
    signalMap[selectedDate] ??
    baseSignalMap[selectedDate] ??
    getBaseCalendarSignal(selectedDate, appData)
  const selectedPlan = appData.datePlans[selectedDate] ?? { date: selectedDate, tasks: [], note: '' }
  const selectedAgenda =
    agendaMap[selectedDate] ?? getCalendarAgendaForDate(appData, selectedDate, todayKey)
  const selectedItems = getUniqueAgendaItems(
    selectedAgenda.filter(
      (item) =>
        item.source === 'focus' ||
        item.source === 'backlog' ||
        item.source === 'datePlan' ||
        item.source === 'ritual',
    ),
  )
  const selectedEvents = getUniqueAgendaItems(
    selectedAgenda.filter((item) => item.source === 'event'),
  )
  const selectedLabels = getSignalLabels(selectedSignal)

  return (
    <section ref={calendarRef} className={`panel solid-panel calendar-panel ${variant}`}>
      <div className="panel-header calendar-header">
        <div className="panel-title">
          <span className="panel-icon-chip calendar">
            <CalendarIcon width={16} height={16} />
          </span>
          <div>
            <h2>{variant === 'stage' ? '全屏月历' : '日历'}</h2>
          </div>
        </div>
        <div className="calendar-controls">
          <button className="icon-button" type="button" onClick={onPrevMonth} aria-label="上一月">
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <span className="calendar-label">{getMonthLabel(viewDate)}</span>
          <button className="icon-button" type="button" onClick={onNextMonth} aria-label="下一月">
            <ChevronRightIcon width={18} height={18} />
          </button>
          <button className="icon-button" type="button" onClick={onToday} aria-label="回到今天">
            今天
          </button>
          {onOpenStage ? (
            <button className="icon-button" type="button" onClick={onOpenStage} aria-label="展开全屏月历">
              <ExpandIcon width={18} height={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="calendar-body">
        <div className="calendar-month">
          <div className="calendar-weekdays">
            {weekLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className={`calendar-grid ${variant}`}>
            {cells.map((cell, index) => {
              const signal = signalMap[cell.dateKey] ?? baseSignalMap[cell.dateKey]
              const isSelected = cell.dateKey === selectedDate
              const isToday = cell.dateKey === todayKey
              const labels = getSignalLabels(signal)
              const labelTexts = labels.map((label) => label.text)
              const signalText = labelTexts.join(' · ')
              const compactSignal = getCompactSignalLabel(signal)
              const agenda = agendaMap[cell.dateKey] ?? []
              const agendaItems = getUniqueAgendaItems(agenda, labelTexts)

              return (
                <button
                  key={cell.dateKey}
                  className={[
                    'calendar-day',
                    cell.inCurrentMonth ? '' : 'outside',
                    isSelected ? 'selected' : '',
                    isToday ? 'today' : '',
                    isSelected && isToday ? 'today-selected' : '',
                    signal.isWeekend ? 'weekend' : '',
                    variant === 'sidebar' ? 'compact' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  data-date-key={cell.dateKey}
                  tabIndex={cell.dateKey === rovingDateKey ? 0 : -1}
                  onClick={() => handleDayClick(cell.dateKey)}
                  onKeyDown={(event) => {
                    const moves: Partial<Record<typeof event.key, string>> = {
                      ArrowLeft: shiftDateByDays(cell.dateKey, -1),
                      ArrowRight: shiftDateByDays(cell.dateKey, 1),
                      ArrowUp: shiftDateByDays(cell.dateKey, -7),
                      ArrowDown: shiftDateByDays(cell.dateKey, 7),
                      Home: shiftDateByDays(cell.dateKey, -(index % 7)),
                      End: shiftDateByDays(cell.dateKey, 6 - (index % 7)),
                      PageUp: shiftDateByMonths(cell.dateKey, -1),
                      PageDown: shiftDateByMonths(cell.dateKey, 1),
                    }
                    const nextDate = moves[event.key]
                    if (!nextDate) return
                    event.preventDefault()
                    focusDate(nextDate)
                  }}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${formatLongDate(cell.dateKey)}${isToday ? '，今天' : ''}${labels.length > 0 ? `，${labels.map((label) => label.text).join('，')}` : ''}`}
                >
                  <span className="day-number-row">
                    <span className="day-number">{cell.day}</span>
                    <span className="day-number-meta">
                      {isToday ? <span className="day-flag">今</span> : null}
                      {variant === 'sidebar' && !isToday && agendaItems.length > 0 ? (
                        <span className="day-agenda-count" aria-hidden="true">
                          {agendaItems.length > 9 ? '9+' : agendaItems.length}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {variant === 'sidebar' && compactSignal ? (
                    <span
                      className={`day-signal compact-calendar-signal ${compactSignal.tone}`}
                    >
                      {compactSignal.text}
                    </span>
                  ) : null}
                  {variant === 'stage' && signalText ? (
                    <span className="day-signal-list">
                      <span className={`day-signal ${labels[0]?.tone ?? 'neutral'}`}>
                        {signalText}
                      </span>
                    </span>
                  ) : null}
                  {variant === 'stage' ? (
                    <AgendaPreview agenda={agenda} excludedTexts={labelTexts} />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {variant === 'sidebar' ? (
          <aside className="selected-date-card" aria-label="选中日期详情">
            <div className="selected-date-heading">
              <div>
                <span className="selected-date-kicker">{selectedDate === todayKey ? '今天' : '已选日期'}</span>
                <h3>{formatLongDate(selectedDate)}</h3>
              </div>
              {onOpenPlanner ? (
                <button className="secondary-button" type="button" onClick={onOpenPlanner}>
                  <NoteIcon width={16} height={16} />
                  安排
                </button>
              ) : null}
            </div>
            <div className="selected-date-overview">
              {selectedLabels.length > 0 ? (
                <div className="selected-date-badges">
                  {selectedLabels.slice(0, 2).map((label) => (
                    <span key={label.text} className={`badge ${label.tone}`}>{label.text}</span>
                  ))}
                </div>
              ) : null}
              <div className="selected-date-section">
                {selectedItems.length === 0 && selectedEvents.length === 0 && !selectedPlan.note.trim() ? (
                  <p>添加这天要做的事。</p>
                ) : (
                  <div className="selected-agenda-list" role="list">
                    {selectedItems.map((item) => (
                      <div key={item.key} className="selected-agenda-item" role="listitem">
                        <span className={`badge ${getAgendaTone(item)}`}>
                          {getAgendaContextLabel(item)}
                        </span>
                        <span className={item.completed ? 'completed' : ''}>{item.text}</span>
                      </div>
                    ))}
                    {selectedEvents.map((event) => (
                      <div key={event.key} className="selected-agenda-item" role="listitem">
                        <span className="badge warm">重要</span>
                        <span>{event.text}</span>
                      </div>
                    ))}
                    {selectedPlan.note.trim() ? (
                      <div className="selected-agenda-item" role="listitem">
                        <span className="badge neutral">短记</span>
                        <span>{selectedPlan.note}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  )
}

function AgendaPreview({
  agenda,
  excludedTexts = [],
}: {
  agenda: CalendarAgendaItem[]
  excludedTexts?: string[]
}) {
  const items = getUniqueAgendaItems(agenda, excludedTexts)
  if (items.length === 0) return null

  return (
    <span className="stage-task-preview">
      {items.slice(0, 3).map((item) => (
        <span key={item.key} className={`stage-task-title ${item.completed ? 'completed' : ''}`}>
          {item.text}
        </span>
      ))}
      {items.length > 3 ? <span className="stage-task-more">+{items.length - 3}</span> : null}
    </span>
  )
}
