import { useEffect, useMemo, useRef, useState } from 'react'

import type { AppData } from '../store/appData'
import { FocusIcon, LoopIcon, MilestoneIcon, SearchIcon, StackIcon } from './Icon'

interface SearchOverlayProps {
  appData: AppData
  onClose: () => void
}

interface SearchResult {
  id: string
  label: string
  meta: string
  type: 'focus' | 'backlog' | 'ritual' | 'event'
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
      meta: `${event.date} · ${event.type === 'countdown' ? '倒数日' : '自定义'}`,
      type: 'event',
    })
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
  }
}

export function SearchOverlay({ appData, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const index = useMemo(() => buildSearchIndex(appData), [appData])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return index.filter((item) => item.label.toLowerCase().includes(q))
  }, [query, index])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="search-overlay" role="presentation" onClick={onClose}>
      <div className="search-panel glass-panel" onClick={(event) => event.stopPropagation()}>
        <div className="search-input-row">
          <SearchIcon width={18} height={18} className="search-input-icon" />
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索任务、节律、事件..."
            aria-label="全局搜索"
          />
        </div>

        {filtered.length > 0 ? (
          <div className="search-results">
            {filtered.map((item) => (
              <div key={item.id} className="search-result-item" onClick={onClose}>
                <span className="search-result-icon">{getTypeIcon(item.type)}</span>
                <div>
                  <div className="search-result-label">{item.label}</div>
                  <div className="search-result-meta">{item.meta}</div>
                </div>
              </div>
            ))}
          </div>
        ) : query.trim() ? (
          <div className="search-hint">没有找到匹配的结果</div>
        ) : (
          <div className="search-hint">输入关键词</div>
        )}
      </div>
    </div>
  )
}
