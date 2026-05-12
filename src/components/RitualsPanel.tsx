import { useState } from 'react'

import { getTodayKey, toDateKey } from '../lib/date'
import type { Ritual } from '../store/appData'
import { CheckIcon, FireIcon, LoopIcon, PlusIcon, TrashIcon } from './Icon'

interface RitualsPanelProps {
  rituals: Ritual[]
  todayKey: string
  onAdd: (text: string) => void
  onToggle: (ritualId: string, dateKey: string) => void
  onDelete: (ritualId: string) => void
  onUpdate: (ritualId: string, text: string) => void
  onDropRitual: (ritualId: string, targetId: string) => void
}

function computeStreak(ritual: Ritual) {
  let streak = 0
  const cursor = new Date(getTodayKey())

  while (true) {
    const key = toDateKey(cursor)
    if (!ritual.completionHistory[key]) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
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

  return (
    <section className="panel solid-panel rituals-panel">
      <div className="panel-side-layout">
        <aside className="panel-side-header">
          <div className="panel-side-top">
            <span className="panel-icon-chip ritual">
              <LoopIcon width={16} height={16} />
            </span>
            <div className="panel-title-vertical">
              <p className="eyebrow">Daily rituals</p>
              <h2>固定节律</h2>
            </div>
            <div className="panel-side-meta">
              <strong>{rituals.filter((ritual) => ritual.completionHistory[todayKey]).length}</strong>
              <span>今日完成</span>
            </div>
          </div>
        </aside>

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
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="新增固定日常任务"
              aria-label="新增固定日常任务"
            />
            <button className="primary-button secondary" type="submit" aria-label="新增循环任务">
              <PlusIcon width={18} height={18} />
            </button>
          </form>

          <div className="ritual-chip-grid">
            {rituals.map((ritual) => {
              const done = Boolean(ritual.completionHistory[todayKey])
              const streak = computeStreak(ritual)
              const isDragging = dragId === ritual.id
              const isDragOver = dragOverId === ritual.id

              return (
                <article 
                  key={ritual.id} 
                  className={`ritual-chip ${done ? 'done' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  draggable
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
                      aria-label="切换循环任务完成状态"
                    >
                      {done ? <CheckIcon width={12} height={12} /> : null}
                    </button>
                    <button
                      className="ghost-button danger small"
                      type="button"
                      onClick={() => onDelete(ritual.id)}
                      aria-label="删除循环任务"
                    >
                      <TrashIcon width={12} height={12} />
                    </button>
                  </div>
                  <div
                    className="ritual-chip-body"
                    onDoubleClick={() => {
                      setEditingId(ritual.id)
                      setEditingValue(ritual.text)
                    }}
                  >
                    {editingId === ritual.id ? (
                      <input
                        autoFocus
                        className="field inline-edit small"
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
                      <strong className="ritual-chip-label">{ritual.text}</strong>
                    )}
                  </div>
                  <div className="ritual-chip-footer">
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
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
