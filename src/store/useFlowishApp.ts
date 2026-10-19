import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import {
  decodeStoredAppData,
  loadAppDataWithStatus,
  persistAppData,
  rolloverCompletedFocusTasks,
} from '../lib/storage'
import {
  APP_DATA_STORAGE_KEY,
  createEvent,
  createId,
  createRitual,
  createTask,
  type AppData,
  type EventItem,
  type Preferences,
  type Quote,
  type Ritual,
  type Task,
  type TaskBucket,
  type TaskPriority,
  type TaskSchedule,
} from './appData'

export type ListBucket = Exclude<TaskBucket, 'date'>

export interface UndoOperation {
  message: string
  restore: () => void
}

type AppAction =
  | { type: 'replace'; data: AppData }
  | { type: 'day/rollover'; todayKey: string }
  | { type: 'preferences/update'; patch: Partial<Preferences> }
  | { type: 'task/add'; bucket: ListBucket; task: Task }
  | { type: 'task/toggle'; bucket: ListBucket; taskId: string; updatedAt: string }
  | { type: 'task/update'; bucket: ListBucket; taskId: string; text: string; updatedAt: string }
  | {
      type: 'task/schedule'
      bucket: ListBucket
      taskId: string
      patch: TaskSchedule
      updatedAt: string
    }
  | { type: 'task/remove'; bucket: ListBucket; taskId: string }
  | { type: 'task/restore'; bucket: ListBucket; task: Task; index: number }
  | { type: 'task/restore-many'; bucket: ListBucket; entries: Array<{ task: Task; index: number }> }
  | {
      type: 'task/move'
      sourceBucket: ListBucket
      targetBucket: ListBucket
      taskId: string
      targetId: string | null
      updatedAt: string
    }
  | { type: 'ritual/add'; ritual: Ritual }
  | { type: 'ritual/toggle'; ritualId: string; dateKey: string; updatedAt: string }
  | { type: 'ritual/update'; ritualId: string; text: string; updatedAt: string }
  | { type: 'ritual/remove'; ritualId: string }
  | { type: 'ritual/restore'; ritual: Ritual; index: number }
  | { type: 'ritual/move'; ritualId: string; targetId: string | null }
  | { type: 'event/add'; event: EventItem }
  | {
      type: 'event/update'
      eventId: string
      title: string
      date: string
      eventType: EventItem['type']
    }
  | { type: 'event/remove'; eventId: string }
  | { type: 'event/restore'; event: EventItem; index: number }
  | { type: 'quote/add'; quote: Quote }
  | { type: 'quote/toggle'; quoteId: string }
  | { type: 'quote/remove'; quoteId: string }
  | { type: 'quote/restore'; quote: Quote; index: number }
  | { type: 'date-task/add'; dateKey: string; task: Task }
  | { type: 'date-task/toggle'; dateKey: string; taskId: string; updatedAt: string }
  | { type: 'date-task/update'; dateKey: string; taskId: string; text: string; updatedAt: string }
  | { type: 'date-task/remove'; dateKey: string; taskId: string }
  | { type: 'date-note/update'; dateKey: string; note: string }

function getTaskList(data: AppData, bucket: ListBucket) {
  return bucket === 'focus' ? data.focusTasks : data.backlogTasks
}

function setTaskList(data: AppData, bucket: ListBucket, tasks: Task[]): AppData {
  return bucket === 'focus' ? { ...data, focusTasks: tasks } : { ...data, backlogTasks: tasks }
}

function insertAt<T>(items: T[], item: T, index: number) {
  const next = [...items]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
  return next
}

export function reduceAppData(data: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'replace':
      return action.data
    case 'day/rollover':
      if (data.preferences.lastActiveDate === action.todayKey) return data
      return {
        ...data,
        focusTasks: data.focusTasks.filter((task) => !task.completed),
        preferences: { ...data.preferences, lastActiveDate: action.todayKey },
      }
    case 'preferences/update':
      return { ...data, preferences: { ...data.preferences, ...action.patch } }
    case 'task/add':
      return setTaskList(data, action.bucket, [action.task, ...getTaskList(data, action.bucket)])
    case 'task/toggle':
      return setTaskList(
        data,
        action.bucket,
        getTaskList(data, action.bucket).map((task) =>
          task.id === action.taskId
            ? { ...task, completed: !task.completed, updatedAt: action.updatedAt }
            : task,
        ),
      )
    case 'task/update':
      return setTaskList(
        data,
        action.bucket,
        getTaskList(data, action.bucket).map((task) =>
          task.id === action.taskId
            ? { ...task, text: action.text, updatedAt: action.updatedAt }
            : task,
        ),
      )
    case 'task/schedule':
      return setTaskList(
        data,
        action.bucket,
        getTaskList(data, action.bucket).map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                timeSlot:
                  action.bucket === 'focus'
                    ? action.patch.timeSlot === undefined
                      ? task.timeSlot
                      : action.patch.timeSlot
                    : null,
                dueDate:
                  action.bucket === 'backlog'
                    ? action.patch.dueDate === undefined
                      ? task.dueDate
                      : action.patch.dueDate
                    : null,
                updatedAt: action.updatedAt,
              }
            : task,
        ),
      )
    case 'task/remove':
      return setTaskList(
        data,
        action.bucket,
        getTaskList(data, action.bucket).filter((task) => task.id !== action.taskId),
      )
    case 'task/restore': {
      const tasks = getTaskList(data, action.bucket)
      if (tasks.some((task) => task.id === action.task.id)) return data
      return setTaskList(data, action.bucket, insertAt(tasks, action.task, action.index))
    }
    case 'task/restore-many': {
      const tasks = [...getTaskList(data, action.bucket)]
      const knownIds = new Set(tasks.map((task) => task.id))
      for (const entry of [...action.entries].sort((left, right) => left.index - right.index)) {
        if (knownIds.has(entry.task.id)) continue
        tasks.splice(Math.max(0, Math.min(entry.index, tasks.length)), 0, entry.task)
        knownIds.add(entry.task.id)
      }
      return setTaskList(data, action.bucket, tasks)
    }
    case 'task/move': {
      const sourceTasks = [...getTaskList(data, action.sourceBucket)]
      const sourceIndex = sourceTasks.findIndex((task) => task.id === action.taskId)
      if (sourceIndex === -1) return data

      const [task] = sourceTasks.splice(sourceIndex, 1)
      const movedTask =
        action.sourceBucket === action.targetBucket
          ? task
          : {
              ...task,
              bucket: action.targetBucket,
              timeSlot: null,
              dueDate: null,
              updatedAt: action.updatedAt,
            }

      if (action.sourceBucket === action.targetBucket) {
        const targetIndex = action.targetId
          ? sourceTasks.findIndex((candidate) => candidate.id === action.targetId)
          : sourceTasks.length
        sourceTasks.splice(targetIndex < 0 ? sourceTasks.length : targetIndex, 0, movedTask)
        return setTaskList(data, action.targetBucket, sourceTasks)
      }

      const targetTasks = [...getTaskList(data, action.targetBucket)]
      const targetIndex = action.targetId
        ? targetTasks.findIndex((candidate) => candidate.id === action.targetId)
        : targetTasks.length
      targetTasks.splice(targetIndex < 0 ? targetTasks.length : targetIndex, 0, movedTask)
      return setTaskList(
        setTaskList(data, action.sourceBucket, sourceTasks),
        action.targetBucket,
        targetTasks,
      )
    }
    case 'ritual/add':
      return { ...data, rituals: [action.ritual, ...data.rituals] }
    case 'ritual/toggle':
      return {
        ...data,
        rituals: data.rituals.map((ritual) => {
          if (ritual.id !== action.ritualId) return ritual
          const completionHistory = { ...ritual.completionHistory }
          if (completionHistory[action.dateKey]) delete completionHistory[action.dateKey]
          else completionHistory[action.dateKey] = true
          return { ...ritual, completionHistory, updatedAt: action.updatedAt }
        }),
      }
    case 'ritual/update':
      return {
        ...data,
        rituals: data.rituals.map((ritual) =>
          ritual.id === action.ritualId
            ? { ...ritual, text: action.text, updatedAt: action.updatedAt }
            : ritual,
        ),
      }
    case 'ritual/remove':
      return { ...data, rituals: data.rituals.filter((ritual) => ritual.id !== action.ritualId) }
    case 'ritual/restore':
      if (data.rituals.some((ritual) => ritual.id === action.ritual.id)) return data
      return { ...data, rituals: insertAt(data.rituals, action.ritual, action.index) }
    case 'ritual/move': {
      const rituals = [...data.rituals]
      const sourceIndex = rituals.findIndex((ritual) => ritual.id === action.ritualId)
      if (sourceIndex === -1) return data
      const [ritual] = rituals.splice(sourceIndex, 1)
      const targetIndex = action.targetId === null
        ? rituals.length
        : rituals.findIndex((candidate) => candidate.id === action.targetId)
      rituals.splice(targetIndex < 0 ? rituals.length : targetIndex, 0, ritual)
      return { ...data, rituals }
    }
    case 'event/add':
      return { ...data, events: [action.event, ...data.events] }
    case 'event/update':
      return {
        ...data,
        events: data.events.map((event) =>
          event.id === action.eventId
            ? {
                ...event,
                title: action.title,
                date: action.date,
                type: action.eventType,
              }
            : event,
        ),
      }
    case 'event/remove':
      return { ...data, events: data.events.filter((event) => event.id !== action.eventId) }
    case 'event/restore':
      if (data.events.some((event) => event.id === action.event.id)) return data
      return { ...data, events: insertAt(data.events, action.event, action.index) }
    case 'quote/add':
      return { ...data, quotes: [...data.quotes, action.quote] }
    case 'quote/toggle': {
      const quote = data.quotes.find((candidate) => candidate.id === action.quoteId)
      if (!quote) return data
      if (quote.enabled && data.quotes.filter((candidate) => candidate.enabled).length === 1) {
        return data
      }
      return {
        ...data,
        quotes: data.quotes.map((quote) =>
          quote.id === action.quoteId ? { ...quote, enabled: !quote.enabled } : quote,
        ),
      }
    }
    case 'quote/remove': {
      const quote = data.quotes.find((candidate) => candidate.id === action.quoteId)
      if (!quote) return data
      if (quote.enabled && data.quotes.filter((candidate) => candidate.enabled).length === 1) {
        return data
      }
      return { ...data, quotes: data.quotes.filter((quote) => quote.id !== action.quoteId) }
    }
    case 'quote/restore':
      if (data.quotes.some((quote) => quote.id === action.quote.id)) return data
      return { ...data, quotes: insertAt(data.quotes, action.quote, action.index) }
    case 'date-task/add': {
      const plan = data.datePlans[action.dateKey] ?? { date: action.dateKey, tasks: [], note: '' }
      return {
        ...data,
        datePlans: {
          ...data.datePlans,
          [action.dateKey]: { ...plan, tasks: [action.task, ...plan.tasks] },
        },
      }
    }
    case 'date-task/toggle': {
      const plan = data.datePlans[action.dateKey]
      if (!plan) return data
      return {
        ...data,
        datePlans: {
          ...data.datePlans,
          [action.dateKey]: {
            ...plan,
            tasks: plan.tasks.map((task) =>
              task.id === action.taskId
                ? { ...task, completed: !task.completed, updatedAt: action.updatedAt }
                : task,
            ),
          },
        },
      }
    }
    case 'date-task/update': {
      const plan = data.datePlans[action.dateKey]
      if (!plan) return data
      return {
        ...data,
        datePlans: {
          ...data.datePlans,
          [action.dateKey]: {
            ...plan,
            tasks: plan.tasks.map((task) =>
              task.id === action.taskId
                ? { ...task, text: action.text, updatedAt: action.updatedAt }
                : task,
            ),
          },
        },
      }
    }
    case 'date-task/remove': {
      const plan = data.datePlans[action.dateKey]
      if (!plan) return data
      return {
        ...data,
        datePlans: {
          ...data.datePlans,
          [action.dateKey]: {
            ...plan,
            tasks: plan.tasks.filter((task) => task.id !== action.taskId),
          },
        },
      }
    }
    case 'date-note/update': {
      const plan = data.datePlans[action.dateKey] ?? { date: action.dateKey, tasks: [], note: '' }
      return {
        ...data,
        datePlans: {
          ...data.datePlans,
          [action.dateKey]: { ...plan, note: action.note },
        },
      }
    }
  }
}

const timestamp = () => new Date().toISOString()

export function useFlowishApp(todayKey: string) {
  const [initialLoad] = useState(loadAppDataWithStatus)
  const [data, dispatch] = useReducer(reduceAppData, initialLoad.data)
  const [lastError, setLastError] = useState<string | null>(initialLoad.error)
  const dataRef = useRef(data)
  const persistenceAllowedRef = useRef(initialLoad.persistenceAllowed)
  const externalDataRef = useRef<AppData | null>(null)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    dispatch({ type: 'day/rollover', todayKey })
  }, [todayKey])

  useEffect(() => {
    const isExternalSnapshot = externalDataRef.current === data
    externalDataRef.current = null

    if (isExternalSnapshot) {
      // The originating tab has already persisted this exact object graph.
    } else if (persistenceAllowedRef.current) {
      try {
        persistAppData(data)
      } catch {
        queueMicrotask(() => setLastError('保存失败，请先导出备份并检查浏览器存储空间。'))
      }
    }

    document.documentElement.dataset.theme = data.preferences.theme
    document.documentElement.dataset.motion = data.preferences.reducedMotion ? 'reduce' : 'default'
    document
      .querySelector<HTMLMetaElement>("meta[name='theme-color']")
      ?.setAttribute('content', data.preferences.theme === 'obsidian' ? '#181a17' : '#f2efe5')
  }, [data])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== APP_DATA_STORAGE_KEY || event.newValue === null) return
      if (event.storageArea !== null && event.storageArea !== window.localStorage) return

      try {
        const decoded = decodeStoredAppData(JSON.parse(event.newValue) as unknown, {
          todayKey,
          reducedMotion: dataRef.current.preferences.reducedMotion,
        })
        const externalData = rolloverCompletedFocusTasks(decoded, todayKey)
        externalDataRef.current = externalData
        persistenceAllowedRef.current = true
        dispatch({
          type: 'replace',
          data: externalData,
        })
        setLastError(null)
      } catch {
        setLastError('另一标签页的数据无法同步，当前内容未更改。')
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [todayKey])

  const commands = useMemo(() => {
    const findTask = (bucket: ListBucket, taskId: string) => {
      const tasks = getTaskList(dataRef.current, bucket)
      const index = tasks.findIndex((task) => task.id === taskId)
      return index < 0 ? null : { task: tasks[index], index }
    }

    return {
      replace(nextData: AppData) {
        persistenceAllowedRef.current = true
        setLastError(null)
        dispatch({ type: 'replace', data: nextData })
      },
      preferences: {
        update(patch: Partial<Preferences>) {
          dispatch({ type: 'preferences/update', patch })
        },
      },
      tasks: {
        add(
          bucket: ListBucket,
          text: string,
          priority: TaskPriority = null,
          schedule: TaskSchedule = {},
        ) {
          dispatch({ type: 'task/add', bucket, task: createTask(text, bucket, priority, schedule) })
        },
        toggle(bucket: ListBucket, taskId: string) {
          dispatch({ type: 'task/toggle', bucket, taskId, updatedAt: timestamp() })
        },
        update(bucket: ListBucket, taskId: string, text: string) {
          dispatch({ type: 'task/update', bucket, taskId, text, updatedAt: timestamp() })
        },
        updateSchedule(bucket: ListBucket, taskId: string, patch: TaskSchedule) {
          dispatch({ type: 'task/schedule', bucket, taskId, patch, updatedAt: timestamp() })
        },
        remove(bucket: ListBucket, taskId: string): UndoOperation | null {
          const found = findTask(bucket, taskId)
          if (!found) return null
          dispatch({ type: 'task/remove', bucket, taskId })
          return {
            message: '已删除任务',
            restore: () => dispatch({ type: 'task/restore', bucket, ...found }),
          }
        },
        move(
          targetBucket: ListBucket,
          sourceBucket: ListBucket,
          taskId: string,
          targetId: string | null,
        ) {
          dispatch({
            type: 'task/move',
            sourceBucket,
            targetBucket,
            taskId,
            targetId,
            updatedAt: timestamp(),
          })
        },
        clearCompleted(bucket: ListBucket): UndoOperation | null {
          const entries = getTaskList(dataRef.current, bucket)
            .map((task, index) => ({ task, index }))
            .filter(({ task }) => task.completed)
          if (entries.length === 0) return null
          for (const { task } of entries) {
            dispatch({ type: 'task/remove', bucket, taskId: task.id })
          }
          return {
            message: '已清理已完成事项',
            restore: () => dispatch({ type: 'task/restore-many', bucket, entries }),
          }
        },
      },
      rituals: {
        add(text: string) {
          dispatch({ type: 'ritual/add', ritual: createRitual(text) })
        },
        toggle(ritualId: string, dateKey: string) {
          dispatch({ type: 'ritual/toggle', ritualId, dateKey, updatedAt: timestamp() })
        },
        update(ritualId: string, text: string) {
          dispatch({ type: 'ritual/update', ritualId, text, updatedAt: timestamp() })
        },
        remove(ritualId: string): UndoOperation | null {
          const index = dataRef.current.rituals.findIndex((ritual) => ritual.id === ritualId)
          if (index < 0) return null
          const ritual = dataRef.current.rituals[index]
          dispatch({ type: 'ritual/remove', ritualId })
          return {
            message: '已删除固定节律',
            restore: () => dispatch({ type: 'ritual/restore', ritual, index }),
          }
        },
        move(ritualId: string, targetId: string | null) {
          dispatch({ type: 'ritual/move', ritualId, targetId })
        },
      },
      events: {
        add(title: string, date: string, eventType: EventItem['type']) {
          dispatch({ type: 'event/add', event: createEvent(title, date, eventType) })
        },
        update(
          eventId: string,
          title: string,
          date: string,
          eventType: EventItem['type'],
        ) {
          dispatch({ type: 'event/update', eventId, title, date, eventType })
        },
        remove(eventId: string): UndoOperation | null {
          const index = dataRef.current.events.findIndex((event) => event.id === eventId)
          if (index < 0) return null
          const event = dataRef.current.events[index]
          dispatch({ type: 'event/remove', eventId })
          return {
            message: '已删除重要日期',
            restore: () => dispatch({ type: 'event/restore', event, index }),
          }
        },
      },
      quotes: {
        add(text: string, author: string) {
          dispatch({
            type: 'quote/add',
            quote: {
              id: createId('quote'),
              text,
              author,
              enabled: true,
              source: 'custom',
            },
          })
        },
        toggle(quoteId: string) {
          dispatch({ type: 'quote/toggle', quoteId })
        },
        remove(quoteId: string): UndoOperation | null {
          const index = dataRef.current.quotes.findIndex((quote) => quote.id === quoteId)
          if (index < 0) return null
          const quote = dataRef.current.quotes[index]
          if (
            quote.enabled &&
            dataRef.current.quotes.filter((candidate) => candidate.enabled).length === 1
          ) {
            return null
          }
          dispatch({ type: 'quote/remove', quoteId })
          return {
            message: '已删除短句',
            restore: () => dispatch({ type: 'quote/restore', quote, index }),
          }
        },
      },
      datePlans: {
        addTask(dateKey: string, text: string) {
          dispatch({ type: 'date-task/add', dateKey, task: createTask(text, 'date') })
        },
        toggleTask(dateKey: string, taskId: string) {
          dispatch({ type: 'date-task/toggle', dateKey, taskId, updatedAt: timestamp() })
        },
        updateTask(dateKey: string, taskId: string, text: string) {
          dispatch({ type: 'date-task/update', dateKey, taskId, text, updatedAt: timestamp() })
        },
        removeTask(dateKey: string, taskId: string) {
          dispatch({ type: 'date-task/remove', dateKey, taskId })
        },
        updateNote(dateKey: string, note: string) {
          dispatch({ type: 'date-note/update', dateKey, note })
        },
      },
    }
  }, [])

  return {
    data,
    commands,
    lastError,
    clearError: () => setLastError(null),
    reportError: (message: string) => setLastError(message),
  }
}
