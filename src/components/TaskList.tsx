import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { FocusTimeSlot, Task, TaskBucket, TaskSchedule } from '../store/appData'
import { CheckIcon, DragIcon, NoteIcon, PlusIcon, TrashIcon } from './Icon'

interface TaskListProps {
  title: string
  eyebrow?: string
  titleIcon?: ReactNode
  bucket: Exclude<TaskBucket, 'date'>
  tasks: Task[]
  accent: 'focus' | 'backlog'
  emptyState: string
  inputPlaceholder: string
  allowClearCompleted?: boolean
  onAdd: (text: string, schedule?: TaskSchedule) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onUpdate: (taskId: string, text: string) => void
  onUpdateSchedule: (taskId: string, patch: TaskSchedule) => void
  onDropTask: (fromBucket: Exclude<TaskBucket, 'date'>, taskId: string, targetId: string | null) => void
  onClearCompleted?: () => void
}

interface TaskRowProps {
  task: Task
  accent: 'focus' | 'backlog'
  bucket: Exclude<TaskBucket, 'date'>
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onUpdate: (taskId: string, text: string) => void
  onUpdateSchedule: (taskId: string, patch: TaskSchedule) => void
  onDropTask: (fromBucket: Exclude<TaskBucket, 'date'>, taskId: string, targetId: string | null) => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  position: number
  total: number
}

const TIME_SLOT_OPTIONS: Array<{ value: FocusTimeSlot; label: string }> = [
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
  { value: 'lateNight', label: '深夜' },
]

function parseTaskPayload(raw: string) {
  try {
    const value = JSON.parse(raw) as { bucket?: TaskBucket; taskId?: string }
    if ((value.bucket === 'focus' || value.bucket === 'backlog') && typeof value.taskId === 'string') {
      return { bucket: value.bucket, taskId: value.taskId }
    }
  } catch {
    // Ignore drops from outside the task board.
  }
  return null
}

function TaskRow({
  task,
  accent,
  bucket,
  onToggle,
  onDelete,
  onUpdate,
  onUpdateSchedule,
  onDropTask,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  position,
  total,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.text)
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [reordering, setReordering] = useState(false)
  const completionTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => () => {
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current)
  }, [])

  const commit = () => {
    const nextValue = draft.trim()
    if (!nextValue) {
      setDraft(task.text)
      setEditing(false)
      return
    }

    onUpdate(task.id, nextValue)
    setEditing(false)
  }

  const startEditing = () => {
    setDraft(task.text)
    setEditing(true)
  }

  const handleToggle = useCallback(() => {
    if (!task.completed) {
      setJustCompleted(true)
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current)
      completionTimerRef.current = window.setTimeout(() => setJustCompleted(false), 500)
    }
    onToggle(task.id)
  }, [task.completed, task.id, onToggle])

  return (
    <article
      data-search-id={task.id}
      tabIndex={-1}
      className={[
        'task-card',
        accent,
        task.completed ? 'completed' : '',
        dragging ? 'dragging' : '',
        dragOver ? 'drag-over' : '',
        justCompleted ? 'just-completed' : '',
        reordering ? 'reordering' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={!editing}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({ bucket, taskId: task.id }))
        event.dataTransfer.effectAllowed = 'move'
        setTimeout(() => setDragging(true), 0)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault()
        if (!dragging) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setDragOver(false)
        const raw = event.dataTransfer.getData('text/plain')
        if (!raw) return

        const payload = parseTaskPayload(raw)
        if (payload && payload.taskId !== task.id) {
          onDropTask(payload.bucket, payload.taskId, task.id)
        }
      }}
    >
      <div className="task-leading">
        <button className="check-button" type="button" onClick={handleToggle} aria-label={`${task.completed ? '取消完成' : '完成'}“${task.text}”`}>
          {task.completed ? <CheckIcon width={16} height={16} /> : null}
        </button>
        {task.priority ? <span className={`priority-dot ${task.priority}`} aria-hidden="true" /> : null}
        <button
          className="drag-button"
          type="button"
          disabled={!canMoveUp && !canMoveDown}
          aria-label={`调整“${task.text}”顺序，第 ${position}/${total} 项`}
          aria-keyshortcuts="ArrowUp ArrowDown"
          aria-expanded={reordering}
          onClick={() => setReordering((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' && canMoveUp) {
              event.preventDefault()
              onMoveUp()
            }
            if (event.key === 'ArrowDown' && canMoveDown) {
              event.preventDefault()
              onMoveDown()
            }
          }}
        >
          <DragIcon width={16} height={16} />
        </button>
      </div>

      <div className="task-copy">
        {editing ? (
          <input
            autoFocus
            className="field inline-edit"
            name={`${task.id}-text`}
            autoComplete="off"
            aria-label="编辑任务内容"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setDraft(task.text)
                setEditing(false)
              }
            }}
          />
        ) : (
          <>
            <p className="task-title" onDoubleClick={startEditing}>{task.text}</p>
            <div className="task-meta-row">
              {bucket === 'focus' ? (
                <select
                  className="task-schedule-select"
                  value={task.timeSlot ?? ''}
                  aria-label={`“${task.text}”的时间段`}
                  onChange={(event) => onUpdateSchedule(task.id, {
                    timeSlot: event.target.value === '' ? null : event.target.value as FocusTimeSlot,
                  })}
                >
                  <option value="">未分配</option>
                  {TIME_SLOT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="task-due-input"
                  type="date"
                  value={task.dueDate ?? ''}
                  aria-label={`“${task.text}”的截止日期`}
                  onChange={(event) => onUpdateSchedule(task.id, { dueDate: event.target.value || null })}
                />
              )}
              {task.completed ? <span className="task-note">已完成</span> : null}
            </div>
          </>
        )}
      </div>

      <div className={`task-actions ${reordering ? 'reordering' : ''}`}>
        {reordering ? (
          <>
            <button className="order-button" type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label={`上移“${task.text}”`}>
              上移
            </button>
            <button className="order-button" type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label={`下移“${task.text}”`}>
              下移
            </button>
            <button className="order-button" type="button" onClick={() => setReordering(false)} aria-label={`收起“${task.text}”排序`}>
              收起
            </button>
          </>
        ) : (
          <>
            <button
              className="ghost-button"
              type="button"
              onClick={startEditing}
              aria-label={`编辑“${task.text}”`}
            >
              <NoteIcon width={16} height={16} />
            </button>
            <button className="ghost-button danger" type="button" onClick={() => onDelete(task.id)} aria-label={`删除“${task.text}”`}>
              <TrashIcon width={16} height={16} />
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export function TaskList({
  title,
  eyebrow,
  titleIcon,
  bucket,
  tasks,
  accent,
  emptyState,
  inputPlaceholder,
  allowClearCompleted,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onUpdateSchedule,
  onDropTask,
  onClearCompleted,
}: TaskListProps) {
  const [inputValue, setInputValue] = useState('')
  const [newTimeSlot, setNewTimeSlot] = useState<FocusTimeSlot>('morning')
  const [newDueDate, setNewDueDate] = useState('')
  const [orderAnnouncement, setOrderAnnouncement] = useState('')
  const [announcedTask, setAnnouncedTask] = useState<{ id: string; text: string } | null>(null)
  const pendingCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks])
  const visibleOrderAnnouncement = announcedTask && tasks.some(
    (task) => task.id === announcedTask.id && task.text === announcedTask.text,
  )
    ? orderAnnouncement
    : ''

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = inputValue.trim()
    if (!value) return
    onAdd(
      value,
      bucket === 'focus'
        ? { timeSlot: newTimeSlot }
        : { dueDate: newDueDate || null },
    )
    setInputValue('')
    if (bucket === 'backlog') setNewDueDate('')
  }

  return (
    <section className={`panel solid-panel task-panel task-panel-${accent}`} aria-label={title}>
      <div className="panel-side-layout">
        <header className="panel-side-header">
          <div className="panel-side-top">
            <span className={`panel-icon-chip ${accent}`}>{titleIcon}</span>
            <div className="panel-title-vertical">
              {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
              <h2>{title}</h2>
            </div>
            <div className="panel-side-meta">
              <strong>{pendingCount}</strong>
              <span>待处理</span>
            </div>
          </div>

          {allowClearCompleted && onClearCompleted ? (
            <button
              className="side-cleanup-btn"
              type="button"
              onClick={onClearCompleted}
              aria-label="清理已完成事项"
            >
              <TrashIcon width={18} height={18} />
            </button>
          ) : null}
        </header>

        <div className="panel-content">
          <form className={`inline-composer task-composer ${accent} glass-ridge`} onSubmit={handleSubmit}>
            <input
              className="field"
              name={`${bucket}-task`}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={inputPlaceholder}
              aria-label={inputPlaceholder}
              autoComplete="off"
              required
            />
            {bucket === 'focus' ? (
              <select
                className="composer-schedule-select"
                value={newTimeSlot}
                aria-label="新任务时间段"
                onChange={(event) => setNewTimeSlot(event.target.value as FocusTimeSlot)}
              >
                {TIME_SLOT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : (
              <input
                className="composer-due-input"
                type="date"
                value={newDueDate}
                aria-label="新任务截止日期"
                onChange={(event) => setNewDueDate(event.target.value)}
              />
            )}
            <button className="primary-button" type="submit" aria-label="新增任务">
              <PlusIcon width={18} height={18} />
            </button>
          </form>

          <div
            className="task-list"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const raw = event.dataTransfer.getData('text/plain')
              if (!raw) return
              const payload = parseTaskPayload(raw)
              if (payload) onDropTask(payload.bucket, payload.taskId, null)
            }}
          >
            {tasks.length === 0 ? (
              <div className="empty-card">{emptyState}</div>
            ) : null}
            {tasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                accent={accent}
                bucket={bucket}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onUpdateSchedule={onUpdateSchedule}
                onDropTask={onDropTask}
                canMoveUp={index > 0}
                canMoveDown={index < tasks.length - 1}
                position={index + 1}
                total={tasks.length}
                onMoveUp={() => {
                  onDropTask(bucket, task.id, tasks[index - 1]?.id ?? null)
                  setOrderAnnouncement(`已将“${task.text}”上移到第 ${index} 项`)
                  setAnnouncedTask({ id: task.id, text: task.text })
                }}
                onMoveDown={() => {
                  onDropTask(bucket, task.id, tasks[index + 2]?.id ?? null)
                  setOrderAnnouncement(`已将“${task.text}”下移到第 ${index + 2} 项`)
                  setAnnouncedTask({ id: task.id, text: task.text })
                }}
              />
            ))}
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {visibleOrderAnnouncement}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
