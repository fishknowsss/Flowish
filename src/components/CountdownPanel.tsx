import { useMemo, useState } from 'react'

import { formatShortDate, getEventDayCopy, getEventDays, getEventTypeLabel } from '../lib/date'
import type { EventItem } from '../store/appData'
import { MilestoneIcon, PlusIcon, TrashIcon } from './Icon'

interface CountdownPanelProps {
  events: EventItem[]
  onAdd: (title: string, date: string, type: EventItem['type']) => void
  onDelete: (eventId: string) => void
}

export function CountdownPanel({ events, onAdd, onDelete }: CountdownPanelProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<EventItem['type']>('countdown')

  const sorted = useMemo(
    () => [...events].sort((left, right) => getEventDays(left) - getEventDays(right)),
    [events],
  )

  return (
    <section className="panel solid-panel countdown-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-icon-chip warm">
            <MilestoneIcon width={16} height={16} />
          </span>
          <div>
          <p className="eyebrow">Days</p>
          <h2>重要日期</h2>
          </div>
        </div>
        <div className="panel-meta">
          <strong>{sorted.length}</strong>
          <span>已记录</span>
        </div>
      </div>

      <form
        className="countdown-form glass-ridge"
        onSubmit={(event) => {
          event.preventDefault()
          const nextTitle = title.trim()
          if (!nextTitle || !date) return
          onAdd(nextTitle, date, type)
          setTitle('')
          setDate('')
          setType('countdown')
        }}
      >
        <input
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="添加一个重要日期"
          aria-label="添加重要日期"
        />
        <input
          className="field compact-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <select
          className="field compact-select"
          value={type}
          onChange={(event) => setType(event.target.value as EventItem['type'])}
        >
          <option value="countdown">倒数日</option>
          <option value="countup">正数日</option>
          <option value="annual">年纪日</option>
        </select>
        <button className="primary-button warm" type="submit" aria-label="新增事件">
          <PlusIcon width={18} height={18} />
        </button>
      </form>

      <div className="milestone-grid">
        {sorted.length === 0 ? <div className="empty-card">先添加一个重要日期。</div> : null}
        {sorted.map((event) => {
          const remainingDays = getEventDays(event)
          const dayCopy = getEventDayCopy(event)
          const tone =
            remainingDays < 0
              ? 'muted'
              : remainingDays === 0
                ? 'urgent'
                : remainingDays <= 3
                  ? 'warm'
                  : 'cool'

          return (
            <article key={event.id} className={`milestone-card glass-ridge ${tone}`}>
              <div className="milestone-days">
                <strong>{dayCopy.value}</strong>
                {dayCopy.unit ? <span>{dayCopy.unit}</span> : null}
              </div>
              <div className="milestone-info">
                <p className="milestone-title">{event.title}</p>
                <span className="milestone-meta">{formatShortDate(event.date)} · {getEventTypeLabel(event.type)}</span>
              </div>
              <button className="ghost-button danger small" type="button" onClick={() => onDelete(event.id)} aria-label="删除事件">
                <TrashIcon width={14} height={14} />
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
