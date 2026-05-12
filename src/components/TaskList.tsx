import type { FormEvent, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'

import type { Task, TaskBucket, TaskPriority } from '../store/appData'
import { CheckIcon, DragIcon, NoteIcon, PlusIcon, TrashIcon } from './Icon'

interface TaskListProps {
  title: string
  eyebrow: string
  titleIcon?: ReactNode
  bucket: Exclude<TaskBucket, 'date'>
  tasks: Task[]
  accent: 'focus' | 'backlog'
  emptyState: string
  inputPlaceholder: string
  allowClearCompleted?: boolean
  onAdd: (text: string, priority?: TaskPriority) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onUpdate: (taskId: string, text: string) => void
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
  onDropTask: (fromBucket: Exclude<TaskBucket, 'date'>, taskId: string, targetId: string | null) => void
}

function TaskRow({
  task,
  accent,
  bucket,
  onToggle,
  onDelete,
  onUpdate,
  onDropTask,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.text)
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

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

  const handleToggle = useCallback(() => {
    if (!task.completed) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 500)
    }
    onToggle(task.id)
  }, [task.completed, task.id, onToggle])

  return (
    <article
      className={[
        'task-card',
        accent,
        task.completed ? 'completed' : '',
        dragging ? 'dragging' : '',
        dragOver ? 'drag-over' : '',
        justCompleted ? 'just-completed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={!editing}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({ bucket, taskId: task.id }))
        event.dataTransfer.effectAllowed = 'move'
        // Create a custom drag image if needed, or rely on opacity
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
        setDragOver(false)
        const raw = event.dataTransfer.getData('text/plain')
        if (!raw) return

        const payload = JSON.parse(raw) as { bucket: Exclude<TaskBucket, 'date'>; taskId: string }
        if (payload.taskId !== task.id) {
          onDropTask(payload.bucket, payload.taskId, task.id)
        }
      }}
    >
      <div className="task-leading">
        <button className="check-button" type="button" onClick={handleToggle} aria-label="切换任务完成状态">
          {task.completed ? <CheckIcon width={16} height={16} /> : null}
        </button>
        {task.priority ? <span className={`priority-dot ${task.priority}`} title={task.priority.toUpperCase()} /> : null}
        <button className="drag-button" type="button" aria-label="拖拽任务">
          <DragIcon width={16} height={16} />
        </button>
      </div>

      <div className="task-copy" onDoubleClick={() => setEditing(true)}>
        {editing ? (
          <input
            autoFocus
            className="field inline-edit"
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
            <p className="task-title">{task.text}</p>
            {task.completed ? <span className="task-note">已完成</span> : null}
          </>
        )}
      </div>

      <div className="task-actions">
        <button className="ghost-button" type="button" onClick={() => setEditing(true)} aria-label="编辑任务">
          <NoteIcon width={16} height={16} />
        </button>
        <button className="ghost-button danger" type="button" onClick={() => onDelete(task.id)} aria-label="删除任务">
          <TrashIcon width={16} height={16} />
        </button>
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
  onDropTask,
  onClearCompleted,
}: TaskListProps) {
  const [inputValue, setInputValue] = useState('')
  const pendingCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = inputValue.trim()
    if (!value) return
    onAdd(value)
    setInputValue('')
  }

  return (
    <section className={`panel solid-panel task-panel task-panel-${accent}`}>
      <div className="panel-side-layout">
        <aside className="panel-side-header">
          <div className="panel-side-top">
            <span className={`panel-icon-chip ${accent}`}>{titleIcon}</span>
            <div className="panel-title-vertical">
              <p className="eyebrow">{eyebrow}</p>
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
              title="清理已完成"
            >
              <TrashIcon width={18} height={18} />
            </button>
          ) : null}
        </aside>

        <div className="panel-content">
          <form className="inline-composer glass-ridge" onSubmit={handleSubmit}>
            <input
              className="field"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={inputPlaceholder}
              aria-label={inputPlaceholder}
            />
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
              const payload = JSON.parse(raw) as { bucket: Exclude<TaskBucket, 'date'>; taskId: string }
              onDropTask(payload.bucket, payload.taskId, null)
            }}
          >
            {tasks.length === 0 ? (
              <div className="empty-card-visual">
                <div className="empty-icon-wrap">{titleIcon}</div>
                <p>{emptyState}</p>
              </div>
            ) : null}
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                accent={accent}
                bucket={bucket}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onDropTask={onDropTask}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
