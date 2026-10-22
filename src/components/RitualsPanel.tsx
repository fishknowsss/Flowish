import { useState } from 'react'

import { CardPager } from './CardPager'

import { formatShortDate, parseDateKey, toDateKey } from '../lib/date'
import type { Ritual } from '../store/appData'
import { CheckIcon, FireIcon, LoopIcon, NoteIcon, PlusIcon, TrashIcon } from './Icon'

interface RitualsPanelProps {
  rituals: Ritual[]
  todayKey: string
  onAdd: (text: string) => void
  onToggle: (ritualId: string, dateKey: string) => void
  onDelete: (ritualId: string) => void
  onUpdate: (ritualId: string, text: string) => void
  onDropRitual: (ritualId: string, targetId: string | null) => void
}

function computeStreak(ritual: Ritual, todayKey: string) {
  let streak = 0
  const cursor = parseDateKey(todayKey)

  while (true) {
    const key = toDateKey(cursor)
    if (!ritual.completionHistory[key]) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'] as const

function getWeekDateKeys(todayKey: string) {
  const today = parseDateKey(todayKey)
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

  return weekdayLabels.map((label, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return { dateKey: toDateKey(date), label }
  })
}

export function RitualsPanel({
  rituals,
  todayKey,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onDropRitual,
}: RitualsPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [orderAnnouncement, setOrderAnnouncement] = useState('')
  const [announcedRitual, setAnnouncedRitual] = useState<{ id: string; text: string } | null>(null)
  const visibleOrderAnnouncement = announcedRitual && rituals.some(
    (ritual) => ritual.id === announcedRitual.id && ritual.text === announcedRitual.text,
  )
    ? orderAnnouncement
    : ''
  const completedCount = rituals.filter((ritual) => ritual.completionHistory[todayKey]).length
  const weekDates = getWeekDateKeys(todayKey)

  return (
    <section className="panel solid-panel rituals-panel" aria-label="固定节律">
      <div className="panel-side-layout">
        <header className="panel-side-header">
          <div className="panel-side-top">
            <span className="panel-icon-chip ritual">
              <LoopIcon width={16} height={16} />
            </span>
            <div className="panel-title-vertical">
              <h2>固定节律</h2>
            </div>
            <div className="panel-side-meta">
              <strong>{completedCount}/{rituals.length}</strong>
              <span>今日</span>
            </div>
          </div>
          <progress
            className="ritual-progress"
            value={completedCount}
            max={Math.max(rituals.length, 1)}
            aria-label="固定节律今日完成进度"
          >
            {completedCount}/{rituals.length}
          </progress>
        </header>

        <div className="panel-content">
          <form
            className="inline-composer glass-ridge"
            onSubmit={(event) => {
              event.preventDefault()
              const value = inputValue.trim()
              if (!value) return
              onAdd(value)
              setInputValue('')
            }}
          >
            <input
              className="field"
              name="ritual-task"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="新增固定日常任务"
              aria-label="新增固定日常任务"
              autoComplete="off"
              required
            />
            <button className="primary-button secondary" type="submit" aria-label="新增循环任务">
              <PlusIcon width={18} height={18} />
            </button>
          </form>

          <div
            className="ritual-chip-grid"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const sourceId = event.dataTransfer.getData('text/plain')
              if (sourceId) onDropRitual(sourceId, null)
              setDragOverId(null)
            }}
          >
            {rituals.length === 0 ? <div className="empty-card">添加一个每天重复的动作。</div> : null}
            <CardPager label="固定节律" columns={3} minCardWidth={96} minCardHeight={76}>
              {rituals.map((ritual, index) => {
                const done = Boolean(ritual.completionHistory[todayKey])
                const streak = computeStreak(ritual, todayKey)
                const isDragging = dragId === ritual.id
                const isDragOver = dragOverId === ritual.id
                const isEditing = editingId === ritual.id
                const startEditing = () => {
                  setEditingId(ritual.id)
                  setEditingValue(ritual.text)
                }
                const moveUp = () => {
                  if (index === 0) return
                  onDropRitual(ritual.id, rituals[index - 1]?.id ?? null)
                  setOrderAnnouncement(`已将“${ritual.text}”上移到第 ${index} 项`)
                  setAnnouncedRitual({ id: ritual.id, text: ritual.text })
                }
                const moveDown = () => {
                  if (index >= rituals.length - 1) return
                  onDropRitual(ritual.id, rituals[index + 2]?.id ?? null)
                  setOrderAnnouncement(`已将“${ritual.text}”下移到第 ${index + 2} 项`)
                  setAnnouncedRitual({ id: ritual.id, text: ritual.text })
                }

                return (
                  <article
                    key={ritual.id}
                    data-search-id={ritual.id}
                    tabIndex={0}
                    aria-label={`${ritual.text}，可拖动排序`}
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || !event.altKey) return
                      if (event.key === 'ArrowUp') { event.preventDefault(); moveUp() }
                      if (event.key === 'ArrowDown') { event.preventDefault(); moveDown() }
                    }}
                    className={`ritual-chip ${isEditing ? 'editing' : ''} ${done ? 'done' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', ritual.id)
                      setDragId(ritual.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setDragOverId(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragId !== ritual.id) setDragOverId(ritual.id)
                    }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const sourceId = e.dataTransfer.getData('text/plain')
                      if (sourceId && sourceId !== ritual.id) {
                        onDropRitual(sourceId, ritual.id)
                      }
                      setDragOverId(null)
                    }}
                  >
                    <div className="ritual-chip-top">
                      <button
                        className={`ritual-check small ${done ? 'checked' : ''}`}
                        type="button"
                        onClick={() => onToggle(ritual.id, todayKey)}
                        aria-label={`${done ? '取消完成' : '完成'}“${ritual.text}”`}
                      >
                        {done ? <CheckIcon width={12} height={12} /> : null}
                      </button>
                      {streak > 0 ? (
                        <span className="ritual-streak">
                          <FireIcon
                            width={11}
                            height={11}
                            className={`ritual-streak-icon ${streak >= 7 ? 'hot' : streak >= 3 ? 'warm' : ''}`}
                          />
                          {streak}天
                        </span>
                      ) : null}
                    </div>
                    <div className="ritual-chip-body">
                      {isEditing ? (
                        <input
                          autoFocus
                          className="field inline-edit small"
                          name={`${ritual.id}-text`}
                          autoComplete="off"
                          aria-label="编辑循环任务内容"
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          onBlur={() => {
                            const nextValue = editingValue.trim()
                            if (nextValue) onUpdate(ritual.id, nextValue)
                            setEditingId(null)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              const nextValue = editingValue.trim()
                              if (nextValue) onUpdate(ritual.id, nextValue)
                              setEditingId(null)
                            }
                            if (event.key === 'Escape') setEditingId(null)
                          }}
                        />
                      ) : (
                        <strong className="ritual-chip-label" onDoubleClick={startEditing}>
                          {ritual.text}
                        </strong>
                      )}
                      <div
                        className="ritual-week"
                      >
                        <span className="sr-only">本周</span>
                        <span
                          className="ritual-week-days"
                          role="list"
                          aria-label={`“${ritual.text}”本周完成 ${weekDates.filter(({ dateKey }) => ritual.completionHistory[dateKey]).length} 天`}
                        >
                          {weekDates.map(({ dateKey, label }) => {
                            const complete = Boolean(ritual.completionHistory[dateKey])
                            return (
                              <span
                                key={dateKey}
                                className={`ritual-week-day ${complete ? 'complete' : ''}`}
                                role="listitem"
                                aria-label={`周${label}，${formatShortDate(dateKey)}，${complete ? '已完成' : '未完成'}`}
                                title={`周${label} · ${formatShortDate(dateKey)} · ${complete ? '已完成' : '未完成'}`}
                              >
                                <i aria-hidden="true" />
                              </span>
                            )
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="ritual-chip-footer">
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={startEditing}
                        aria-label={`编辑“${ritual.text}”`}
                      >
                        <NoteIcon width={12} height={12} />
                      </button>
                      <button
                        className="ghost-button danger small"
                        type="button"
                        onClick={() => onDelete(ritual.id)}
                        aria-label={`删除“${ritual.text}”`}
                      >
                        <TrashIcon width={12} height={12} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </CardPager>
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {visibleOrderAnnouncement}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
