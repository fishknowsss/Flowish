import { useEffect, useMemo, useState } from 'react'

import { formatLongDate, getEventTypeLabel } from '../lib/date'
import {
  getBaseCalendarSignal,
  getHydratedCalendarSignal,
  getRitualCompletionCount,
  type CalendarSignal,
} from '../lib/holidays'
import type { DatePlan, EventItem } from '../store/appData'
import { CheckIcon, CloseIcon, NoteIcon, PlusIcon, TrashIcon } from './Icon'

interface DatePlannerDrawerProps {
  dateKey: string
  plan: DatePlan
  appData: import('../store/appData').AppData
  events: EventItem[]
  isOpen: boolean
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
  events,
  isOpen,
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
    <aside className={`drawer glass-panel ${isOpen ? 'expanded' : 'collapsed'}`} aria-label="日期规划面板">
      <div className="drawer-header">
        <div className="panel-title">
          <span className="panel-icon-chip note">
            <NoteIcon width={16} height={16} />
          </span>
          <div>
            <p className="eyebrow">Date agenda</p>
            <h2>{isOpen ? formatLongDate(dateKey) : '选中日期后展开议程'}</h2>
            {isOpen ? (
              <div className="badge-row">
                {displaySignal.holidayName ? <span className="badge warm">{displaySignal.holidayName}</span> : null}
                {displaySignal.solarTerm ? <span className="badge green">{displaySignal.solarTerm}</span> : null}
                {displaySignal.lunarFestival ? <span className="badge blue">{displaySignal.lunarFestival}</span> : null}
                {ritualCount > 0 ? <span className="badge neutral">已完成 {ritualCount} 项节律</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="收起日期议程">
          <CloseIcon width={18} height={18} />
        </button>
      </div>

      {!isOpen ? (
        <div className="drawer-empty-state">
          <p>从月历选一天。</p>
        </div>
      ) : null}

      {isOpen ? (
        <>
      <form
        className="inline-composer glass-ridge"
        onSubmit={(event) => {
          event.preventDefault()
          const value = inputValue.trim()
          if (!value) return
          onAddTask(value)
          setInputValue('')
        }}
      >
        <input
          className="field"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="为这一天写下一条具体计划"
          aria-label="新增日期任务"
        />
        <button className="primary-button tertiary" type="submit" aria-label="新增日期任务">
          <PlusIcon width={18} height={18} />
        </button>
      </form>

      <div className="drawer-section">
        <div className="subheading">
          <span>当天任务</span>
          <strong>{plan.tasks.length}</strong>
        </div>
        <div className="date-task-list">
          {plan.tasks.length === 0 ? <div className="empty-card">这一天还没有写下具体安排。</div> : null}
          {plan.tasks.map((task) => (
            <article key={task.id} className={`task-card date ${task.completed ? 'completed' : ''}`}>
              <button className="check-button" type="button" onClick={() => onToggleTask(task.id)} aria-label="切换日期任务完成状态">
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
              <button className="ghost-button danger" type="button" onClick={() => onDeleteTask(task.id)} aria-label="删除日期任务">
                <TrashIcon width={16} height={16} />
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="drawer-section">
        <div className="subheading">
          <span>当天事件</span>
          <strong>{events.length}</strong>
        </div>
        <div className="event-inline-list">
          {events.length === 0 ? <div className="empty-card subtle">这一天没有重要日期。</div> : null}
          {events.map((event) => (
            <div key={event.id} className="inline-pill">
              <span>{event.title}</span>
              <small>{getEventTypeLabel(event.type)}</small>
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
          value={plan.note}
          maxLength={180}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="记录这一天的提醒、重点或想保留的氛围。"
        />
      </div>
        </>
      ) : null}
    </aside>
  )
}
