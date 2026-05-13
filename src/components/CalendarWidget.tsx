import { useEffect, useMemo, useState } from 'react'

import { buildCalendarGrid, getMonthLabel, formatLongDate } from '../lib/date'
import {
  getBaseCalendarSignal,
  getHydratedCalendarSignalMap,
  type CalendarSignal,
} from '../lib/holidays'
import type { AppData, DatePlan } from '../store/appData'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ExpandIcon } from './Icon'

interface CalendarWidgetProps {
  viewDate: Date
  selectedDate: string
  todayKey: string
  appData: AppData
  variant?: 'sidebar' | 'stage'
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelectDate: (dateKey: string) => void
  onOpenStage?: () => void
}

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

function getSignalLabels(signal: CalendarSignal, plan?: DatePlan) {
  const labels: Array<{ text: string; tone: 'warm' | 'green' | 'blue' | 'neutral' }> = []
  if (signal.solarTerm) labels.push({ text: signal.solarTerm, tone: 'neutral' })
  if (signal.holidayName) labels.push({ text: signal.holidayName, tone: 'warm' })
  if (signal.lunarFestival) labels.push({ text: signal.lunarFestival, tone: 'green' })
  if ((plan?.tasks.length ?? 0) > 0) labels.push({ text: `${plan?.tasks.length} 任务`, tone: 'blue' })
  if (signal.hasEvents) labels.push({ text: '日期', tone: 'warm' })
  if (signal.hasRitualCompletion) labels.push({ text: '节律', tone: 'green' })
  return labels
}

export function CalendarWidget({
  viewDate,
  selectedDate,
  todayKey,
  appData,
  variant = 'sidebar',
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onOpenStage,
}: CalendarWidgetProps) {
  const cells = useMemo(() => buildCalendarGrid(viewDate), [viewDate])
  const [signalMap, setSignalMap] = useState<Record<string, CalendarSignal>>({})

  const baseSignalMap = useMemo(
    () =>
      Object.fromEntries(
        cells.map((cell) => [cell.dateKey, getBaseCalendarSignal(cell.dateKey, appData)]),
      ),
    [appData, cells],
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

  const selectedSignal = signalMap[selectedDate] ?? baseSignalMap[selectedDate] ?? getBaseCalendarSignal(selectedDate, appData)
  const selectedPlan = appData.datePlans[selectedDate] ?? { date: selectedDate, tasks: [], note: '' }
  const selectedEvents = appData.events.filter((event) => event.date === selectedDate)
  const selectedLabels = getSignalLabels(selectedSignal, selectedPlan)

  return (
    <section className={`panel solid-panel calendar-panel ${variant}`}>
      <div className="panel-header calendar-header">
        <div className="panel-title">
          <span className="panel-icon-chip calendar">
            <CalendarIcon width={16} height={16} />
          </span>
          <div>
            <p className="eyebrow">月历</p>
            <h2>{variant === 'stage' ? '全屏月历' : '时间线索'}</h2>
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
            {cells.map((cell) => {
              const signal = signalMap[cell.dateKey] ?? baseSignalMap[cell.dateKey]
              const isSelected = cell.dateKey === selectedDate
              const isToday = cell.dateKey === todayKey
              const plan = appData.datePlans[cell.dateKey]
              const labels = getSignalLabels(signal, plan).slice(0, variant === 'stage' ? 3 : 2)

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
                  onClick={() => handleDayClick(cell.dateKey)}
                  aria-pressed={isSelected}
                >
                  <span className="day-number-row">
                    <span className="day-number">{cell.day}</span>
                    {isToday ? <span className="day-flag">今</span> : null}
                  </span>
                  {labels.length > 0 ? (
                    <span className="day-signal-list">
                      {labels.map((label) => (
                        <span key={`${cell.dateKey}-${label.text}`} className={`day-signal ${label.tone}`}>
                          {label.text}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  <StageTaskPreview plan={appData.datePlans[cell.dateKey]} compact={variant === 'sidebar'} />
                </button>
              )
            })}
          </div>
        </div>

        {variant === 'sidebar' ? (
          <aside className="selected-date-card" aria-label="选中日期详情">
            <div>
              <span className="selected-date-kicker">{selectedDate === todayKey ? '今天' : '选中'}</span>
              <h3>{formatLongDate(selectedDate)}</h3>
            </div>
            <div className="selected-date-badges">
              {selectedLabels.length === 0 ? <span className="badge neutral">无特别标记</span> : null}
              {selectedLabels.map((label) => (
                <span key={label.text} className={`badge ${label.tone}`}>{label.text}</span>
              ))}
            </div>
            <div className="selected-date-section">
              <strong>当天任务</strong>
              {selectedPlan.tasks.length === 0 ? (
                <p>还没有任务</p>
              ) : (
                selectedPlan.tasks.slice(0, 3).map((task) => (
                  <p key={task.id} className={task.completed ? 'completed' : ''}>{task.text}</p>
                ))
              )}
            </div>
            <div className="selected-date-section">
              <strong>重要日期</strong>
              {selectedEvents.length === 0 ? (
                <p>没有重要日期</p>
              ) : (
                selectedEvents.slice(0, 3).map((event) => <p key={event.id}>{event.title}</p>)
              )}
            </div>
            {selectedPlan.note.trim() ? (
              <div className="selected-date-section">
                <strong>短记</strong>
                <p>{selectedPlan.note}</p>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  )
}

function StageTaskPreview({ plan, compact = false }: { plan?: DatePlan; compact?: boolean }) {
  if (!plan || plan.tasks.length === 0) return null
  if (compact) {
    return (
      <span className="stage-task-preview compact">
        <span className={`stage-task-title ${plan.tasks[0]?.completed ? 'completed' : ''}`}>
          {plan.tasks[0]?.text}
        </span>
      </span>
    )
  }

  return (
    <span className="stage-task-preview">
      {plan.tasks.slice(0, 2).map((task) => (
        <span key={task.id} className={`stage-task-title ${task.completed ? 'completed' : ''}`}>
          {task.text}
        </span>
      ))}
      {plan.tasks.length > 2 ? <span className="stage-task-more">+{plan.tasks.length - 2}</span> : null}
    </span>
  )
}
