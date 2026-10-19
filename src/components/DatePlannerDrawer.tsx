import { useEffect, useMemo, useState } from 'react'

import {
  getCalendarAgendaForDate,
  type CalendarAgendaItem,
} from '../lib/calendarAgenda'
import { formatLongDate } from '../lib/date'
import {
  getBaseCalendarSignal,
  getHydratedCalendarSignal,
  getRitualCompletionCount,
  type CalendarSignal,
} from '../lib/holidays'
import type { DatePlan } from '../store/appData'
import { CheckIcon, CloseIcon, NoteIcon, PlusIcon, TrashIcon } from './Icon'
import { DialogShell } from './DialogShell'

const focusTimeSlotLabels = {
  morning: '上午重点',
  afternoon: '下午重点',
  evening: '晚上重点',
  lateNight: '深夜重点',
} as const

function getSyncedSourceLabel(item: CalendarAgendaItem) {
  if (item.source === 'focus') {
    return item.timeSlot ? focusTimeSlotLabels[item.timeSlot] : '今日重点'
  }
  if (item.source === 'backlog') return '截止'
  if (item.source === 'ritual') return '固定节律'
  return '重要日期'
}

interface DatePlannerDrawerProps {
  dateKey: string
  plan: DatePlan
  appData: import('../store/appData').AppData
  onClose: () => void
  onAddTask: (text: string) => void
  onToggleTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onUpdateTask: (taskId: string, text: string) => void
  onNoteChange: (note: string) => void
}

export function DatePlannerDrawer({
  dateKey,
  plan,
  appData,
  onClose,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onNoteChange,
}: DatePlannerDrawerProps) {
  const [inputValue, setInputValue] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [signal, setSignal] = useState<CalendarSignal | null>(null)
  const baseSignal = useMemo(() => getBaseCalendarSignal(dateKey, appData), [appData, dateKey])
  const syncedAgenda = useMemo(
    () =>
      getCalendarAgendaForDate(appData, dateKey).filter(
        (item) => item.source !== 'datePlan',
      ),
    [appData, dateKey],
  )

  useEffect(() => {
    let active = true
    void getHydratedCalendarSignal(dateKey, appData).then((nextSignal) => {
      if (active) setSignal(nextSignal)
    })
    return () => {
      active = false
    }
  }, [dateKey, appData])

  const ritualCount = getRitualCompletionCount(appData.rituals, dateKey)
  const displaySignal = signal ?? baseSignal

  return (
    <DialogShell ariaLabel={`${formatLongDate(dateKey)}的日期计划`} className="planner-dialog" onClose={onClose}>
      <section className="dialog-surface date-planner">
      <header className="drawer-header">
        <div className="panel-title">
          <span className="panel-icon-chip note">
            <NoteIcon width={16} height={16} />
          </span>
          <div>
            <h2>{formatLongDate(dateKey)}</h2>
            <div className="badge-row">
              {displaySignal.holidayName ? <span className="badge warm">{displaySignal.holidayName}</span> : null}
              {displaySignal.solarTerm ? <span className="badge green">{displaySignal.solarTerm}</span> : null}
              {displaySignal.lunarFestival ? <span className="badge blue">{displaySignal.lunarFestival}</span> : null}
              {ritualCount > 0 ? <span className="badge neutral">节律 {ritualCount}</span> : null}
            </div>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭日期计划">
          <CloseIcon width={18} height={18} />
        </button>
      </header>

      <form
        className="inline-composer"
        onSubmit={(event) => {
          event.preventDefault()
          const value = inputValue.trim()
          if (!value) return
          onAddTask(value)
          setInputValue('')
        }}
      >
        <input
          autoFocus
          className="field"
          name="date-task"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="添加这天要做的事"
          aria-label="新增日期任务"
          autoComplete="off"
        />
        <button className="primary-button" type="submit">
          <PlusIcon width={18} height={18} />
          添加
        </button>
      </form>

      <div className="drawer-section">
        <div className="subheading">
          <span>当天任务</span>
          <strong>{plan.tasks.length}</strong>
        </div>
        <div className="date-task-list">
          {plan.tasks.length === 0 ? <div className="empty-card">添加这天要做的事。</div> : null}
          {plan.tasks.map((task) => (
            <article key={task.id} className={`task-card date ${task.completed ? 'completed' : ''}`}>
              <button className="check-button" type="button" onClick={() => onToggleTask(task.id)} aria-label={`${task.completed ? '取消完成' : '完成'}“${task.text}”`}>
                {task.completed ? <CheckIcon width={16} height={16} /> : null}
              </button>
              <div
                className="task-copy"
                onDoubleClick={() => {
                  setEditingTaskId(task.id)
                  setEditingValue(task.text)
                }}
              >
                {editingTaskId === task.id ? (
                  <input
                    autoFocus
                    className="field inline-edit"
                    name={`${task.id}-text`}
                    autoComplete="off"
                    aria-label="编辑日期任务内容"
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => {
                      const nextValue = editingValue.trim()
                      if (nextValue) onUpdateTask(task.id, nextValue)
                      setEditingTaskId(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        const nextValue = editingValue.trim()
                        if (nextValue) onUpdateTask(task.id, nextValue)
                        setEditingTaskId(null)
                      }
                      if (event.key === 'Escape') setEditingTaskId(null)
                    }}
                  />
                ) : (
                  <>
                    <p>{task.text}</p>
                    {task.completed ? <span>已完成</span> : null}
                  </>
                )}
              </div>
              <div className="task-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setEditingTaskId(task.id)
                    setEditingValue(task.text)
                  }}
                  aria-label={`编辑“${task.text}”`}
                >
                  <NoteIcon width={16} height={16} />
                </button>
                <button className="ghost-button danger" type="button" onClick={() => onDeleteTask(task.id)} aria-label={`删除“${task.text}”`}>
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="drawer-section">
        <div className="subheading">
          <span>已同步</span>
          <strong>{syncedAgenda.length}</strong>
        </div>
        <div className="event-inline-list synced-agenda-list" aria-label="已同步内容">
          {syncedAgenda.length === 0 ? (
            <div className="empty-card subtle">为这一天设置截止日期或重要日期。</div>
          ) : null}
          {syncedAgenda.map((item) => (
            <div
              key={item.key}
              className={`inline-pill synced-agenda-item ${item.completed ? 'completed' : ''}`}
            >
              <span>{item.text}</span>
              <small>
                {getSyncedSourceLabel(item)}{item.completed ? ' · 已完成' : ''}
              </small>
            </div>
          ))}
        </div>
      </div>

      <div className="drawer-section grow">
        <div className="subheading">
          <span>日期短记</span>
          <strong>{plan.note.length}/180</strong>
        </div>
        <textarea
          className="note-field"
          name="date-note"
          value={plan.note}
          maxLength={180}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="写下提醒或备注"
          aria-label="日期短记"
          autoComplete="off"
        />
      </div>
      </section>
    </DialogShell>
  )
}
