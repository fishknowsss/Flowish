import { useMemo, useState } from 'react'

import type { AppData } from '../store/appData'
import { getEventTypeLabel } from '../lib/date'
import { FocusIcon, LoopIcon, MilestoneIcon, SearchIcon, StackIcon } from './Icon'
import { DialogShell } from './DialogShell'

interface SearchOverlayProps {
  appData: AppData
  onClose: () => void
  onSelect: (result: SearchResult) => void
}

export interface SearchResult {
  id: string
  label: string
  meta: string
  type: 'focus' | 'backlog' | 'ritual' | 'event' | 'date'
  dateKey?: string
}

function buildSearchIndex(appData: AppData): SearchResult[] {
  const results: SearchResult[] = []

  for (const task of appData.focusTasks) {
    results.push({
      id: task.id,
      label: task.text,
      meta: task.completed ? '已完成 · 今日重点' : '待处理 · 今日重点',
      type: 'focus',
    })
  }

  for (const task of appData.backlogTasks) {
    results.push({
      id: task.id,
      label: task.text,
      meta: task.completed ? '已完成 · 积压事项' : '待处理 · 积压事项',
      type: 'backlog',
    })
  }

  for (const ritual of appData.rituals) {
    results.push({
      id: ritual.id,
      label: ritual.text,
      meta: '固定节律',
      type: 'ritual',
    })
  }

  for (const event of appData.events) {
    results.push({
      id: event.id,
      label: event.title,
      meta: `${event.date} · ${getEventTypeLabel(event.type)}`,
      type: 'event',
    })
  }

  for (const plan of Object.values(appData.datePlans)) {
    for (const task of plan.tasks) {
      results.push({
        id: task.id,
        label: task.text,
        meta: `${plan.date} · 日期计划`,
        type: 'date',
        dateKey: plan.date,
      })
    }
    if (plan.note.trim()) {
      results.push({
        id: `note-${plan.date}`,
        label: plan.note,
        meta: `${plan.date} · 日期短记`,
        type: 'date',
        dateKey: plan.date,
      })
    }
  }

  return results
}

function getTypeIcon(type: SearchResult['type']) {
  switch (type) {
    case 'focus':
      return <FocusIcon width={14} height={14} />
    case 'backlog':
      return <StackIcon width={14} height={14} />
    case 'ritual':
      return <LoopIcon width={14} height={14} />
    case 'event':
      return <MilestoneIcon width={14} height={14} />
    case 'date':
      return <MilestoneIcon width={14} height={14} />
  }
}

export function SearchOverlay({ appData, onClose, onSelect }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const index = useMemo(() => buildSearchIndex(appData), [appData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return index.filter((item) =>
      [item.label, item.meta, item.dateKey].some((value) => value?.toLowerCase().includes(q)),
    )
  }, [query, index])

  return (
    <DialogShell ariaLabel="搜索" className="search-dialog" onClose={onClose}>
      <section className="dialog-surface search-panel">
        <div className="search-input-row">
          <SearchIcon width={18} height={18} className="search-input-icon" />
          <input
            autoFocus
            className="search-input"
            name="global-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索任务、节律或日期"
            aria-label="全局搜索"
            autoComplete="off"
          />
        </div>

        {filtered.length > 0 ? (
          <div className="search-results">
            {filtered.map((item) => (
              <button key={`${item.type}-${item.id}`} className="search-result-item" type="button" onClick={() => onSelect(item)}>
                <span className="search-result-icon">{getTypeIcon(item.type)}</span>
                <div>
                  <div className="search-result-label">{item.label}</div>
                  <div className="search-result-meta">{item.meta}</div>
                </div>
              </button>
            ))}
          </div>
        ) : query.trim() ? (
          <div className="search-hint">换个关键词试试。</div>
        ) : (
          <div className="search-hint">输入关键词开始搜索。</div>
        )}
      </section>
    </DialogShell>
  )
}
