import { useMemo, useState } from 'react'

import { formatShortDate, getEventDayCopy, getEventDays, getEventTypeLabel } from '../lib/date'
import type { EventItem } from '../store/appData'
import { CardPager } from './CardPager'
import { MilestoneIcon, NoteIcon, PlusIcon, TrashIcon } from './Icon'

interface CountdownPanelProps {
  events: EventItem[]
  todayKey: string
  onAdd: (title: string, date: string, type: EventItem['type']) => void
  onUpdate: (eventId: string, title: string, date: string, type: EventItem['type']) => void
  onDelete: (eventId: string) => void
}

export function CountdownPanel({ events, todayKey, onAdd, onUpdate, onDelete }: CountdownPanelProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<EventItem['type']>('countdown')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editType, setEditType] = useState<EventItem['type']>('countdown')

  const sorted = useMemo(
    () => [...events].sort((left, right) => getEventDays(left, todayKey) - getEventDays(right, todayKey)),
    [events, todayKey],
  )

  const startEditing = (event: EventItem) => {
    setEditingId(event.id)
    setEditTitle(event.title)
    setEditDate(event.date)
    setEditType(event.type)
  }

  const cancelEditing = () => setEditingId(null)

  const commitEditing = (eventId: string) => {
    const nextTitle = editTitle.trim()
    if (!nextTitle || !editDate) return
    onUpdate(eventId, nextTitle, editDate, editType)
    setEditingId(null)
  }

  return (
    <section className="panel solid-panel countdown-panel" aria-label="重要日期">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-icon-chip warm">
            <MilestoneIcon width={16} height={16} />
          </span>
          <div>
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
          name="event-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="添加一个重要日期"
          aria-label="添加重要日期"
          autoComplete="off"
          required
        />
        <input
          className="field compact-date"
          type="date"
          name="event-date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="重要日期"
          autoComplete="off"
          required
        />
        <select
          className="field compact-select"
          name="event-type"
          value={type}
          onChange={(event) => setType(event.target.value as EventItem['type'])}
          aria-label="日期类型"
        >
          <option value="countdown">倒数日</option>
          <option value="countup">累计日</option>
          <option value="annual">每年</option>
        </select>
        <button className="primary-button warm" type="submit" aria-label="新增事件">
          <PlusIcon width={18} height={18} />
        </button>
      </form>

      <div className="milestone-grid">
        {sorted.length === 0 ? <div className="empty-card">先添加一个重要日期。</div> : null}
        <CardPager label="重要日期" columns={4} minCardWidth={104}>
          {sorted.map((event) => {
            const remainingDays = getEventDays(event, todayKey)
            const dayCopy = getEventDayCopy(event, todayKey)
            const tone =
              remainingDays < 0
                ? 'muted'
                : remainingDays === 0
                  ? 'urgent'
                  : remainingDays <= 3
                    ? 'warm'
                    : 'cool'

            return (
              <article key={event.id} data-search-id={event.id} tabIndex={-1} className={`milestone-card ${tone} ${editingId === event.id ? 'editing' : ''}`}>
                <div className="milestone-days">
                  <strong>{dayCopy.value}</strong>
                  {dayCopy.unit ? <span>{dayCopy.unit}</span> : null}
                </div>
                {editingId === event.id ? (
                  <form
                    className="milestone-edit-form"
                    onSubmit={(submitEvent) => {
                      submitEvent.preventDefault()
                      commitEditing(event.id)
                    }}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === 'Escape') cancelEditing()
                    }}
                  >
                    <input
                      autoFocus
                      className="field"
                      value={editTitle}
                      aria-label="编辑日期名称"
                      onChange={(changeEvent) => setEditTitle(changeEvent.target.value)}
                      required
                    />
                    <input
                      className="field compact-date"
                      type="date"
                      value={editDate}
                      aria-label="编辑日期"
                      onChange={(changeEvent) => setEditDate(changeEvent.target.value)}
                      required
                    />
                    <select
                      className="field compact-select"
                      value={editType}
                      aria-label="编辑类型"
                      onChange={(changeEvent) => setEditType(changeEvent.target.value as EventItem['type'])}
                    >
                      <option value="countdown">倒数日</option>
                      <option value="countup">累计日</option>
                      <option value="annual">每年</option>
                    </select>
                    <div className="milestone-edit-actions">
                      <button className="primary-button" type="submit">保存</button>
                      <button className="tertiary-button" type="button" onClick={cancelEditing}>取消</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="milestone-info" onDoubleClick={() => startEditing(event)}>
                      <p className="milestone-title">{event.title}</p>
                      <span className="milestone-meta">{formatShortDate(event.date)} · {getEventTypeLabel(event.type)}</span>
                    </div>
                    <div className="milestone-actions">
                      <button className="ghost-button small" type="button" onClick={() => startEditing(event)} aria-label={`编辑“${event.title}”`}>
                        <NoteIcon width={14} height={14} />
                      </button>
                      <button className="ghost-button danger small" type="button" onClick={() => onDelete(event.id)} aria-label={`删除“${event.title}”`}>
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                  </>
                )}
              </article>
            )
          })}
        </CardPager>
      </div>
    </section>
  )
}
