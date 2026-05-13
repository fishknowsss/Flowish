import {
  APP_DATA_STORAGE_KEY,
  APP_DATA_VERSION,
  createEvent,
  createRitual,
  createTask,
  defaultAppData,
  type AppData,
  type EventItem,
  type Quote,
  type QuoteMode,
  type Ritual,
  type Task,
  type ThemeMode,
} from '../store/appData'
import { getTodayKey } from './date'
import { BUILTIN_QUOTES } from './quotes'

type UnknownRecord = Record<string, unknown>
const LEGACY_APP_DATA_STORAGE_KEY = 'liquid_dashboard_pro_app'

function parseJson<T>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function mapLegacyTasks(raw: unknown, bucket: Task['bucket']): Task[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter(isObject)
    .map((item) => {
      const text = typeof item.text === 'string' ? item.text.trim() : ''
      if (!text) return null
      const priority = ['p1', 'p2', 'p3'].includes(item.priority as string)
        ? (item.priority as Task['priority'])
        : null
      const task = createTask(text, bucket, priority)
      return {
        ...task,
        completed: Boolean(item.completed),
      }
    })
    .filter((item): item is Task => item !== null)
}

function mapLegacyEvents(raw: unknown): EventItem[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter(isObject)
    .map((item) => {
      const title =
        typeof item.title === 'string'
          ? item.title.trim()
          : typeof item.name === 'string'
            ? item.name.trim()
            : ''
      const date = typeof item.date === 'string' ? item.date : ''
      if (!title || !date) return null
      const type =
        item.type === 'annual'
          ? 'annual'
          : item.type === 'countup' || item.type === 'custom'
            ? 'countup'
            : 'countdown'
      return createEvent(title, date, type)
    })
    .filter((item): item is EventItem => item !== null)
}

function mapLegacyRituals(raw: unknown): Ritual[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter(isObject)
    .map((item) => {
      const text =
        typeof item.text === 'string'
          ? item.text.trim()
          : typeof item.name === 'string'
            ? item.name.trim()
            : ''
      if (!text) return null
      const ritual = createRitual(text)
      const lastDone = typeof item.lastDone === 'string' ? item.lastDone : null
      return lastDone
        ? {
            ...ritual,
            completionHistory: { [lastDone]: true },
          }
        : ritual
    })
    .filter((item): item is Ritual => item !== null)
}

function sanitizeQuotes(raw: unknown): Quote[] {
  if (!Array.isArray(raw)) return BUILTIN_QUOTES

  const normalized = raw
    .filter(isObject)
    .map((item, index) => {
      const text = typeof item.text === 'string' ? item.text.trim() : ''
      const author = typeof item.author === 'string' ? item.author.trim() : 'Anonymous'
      if (!text) return null
      return {
        id: typeof item.id === 'string' ? item.id : `quote_import_${index}`,
        text,
        author,
        enabled: item.enabled !== false,
        source: item.source === 'custom' ? 'custom' : 'builtin',
      } satisfies Quote
    })
    .filter((item): item is Quote => item !== null)

  return normalized.length > 0 ? normalized : BUILTIN_QUOTES
}

function sanitizeAppData(raw: unknown, reducedMotion: boolean): AppData {
  const todayKey = getTodayKey()

  if (!isObject(raw)) {
    return defaultAppData(todayKey, reducedMotion)
  }

  const fallback = defaultAppData(todayKey, reducedMotion)
  const focusTasks = mapLegacyTasks(raw.focusTasks, 'focus')
  const backlogTasks = mapLegacyTasks(raw.backlogTasks, 'backlog')
  const rituals = mapLegacyRituals(raw.rituals)
  const events = mapLegacyEvents(raw.events)

  const datePlans = isObject(raw.datePlans)
    ? Object.fromEntries(
        Object.entries(raw.datePlans)
          .filter((entry): entry is [string, UnknownRecord] => isObject(entry[1]))
          .map(([date, value]) => {
            const tasks = mapLegacyTasks(value.tasks, 'date')
            const note = typeof value.note === 'string' ? value.note : ''
            return [date, { date, tasks, note }]
          }),
      )
    : fallback.datePlans

  const preferences = isObject(raw.preferences)
    ? {
        soundEnabled: Boolean(raw.preferences.soundEnabled),
        theme: (raw.preferences.theme === 'obsidian' ? 'obsidian' : 'pearl') as ThemeMode,
        reducedMotion:
          typeof raw.preferences.reducedMotion === 'boolean'
            ? raw.preferences.reducedMotion
            : reducedMotion,
        quoteMode:
          (raw.preferences.quoteMode === 'random' ? 'random' : 'daily') as QuoteMode,
        calendarExpandedDefault: Boolean(raw.preferences.calendarExpandedDefault),
        lastActiveDate:
          typeof raw.preferences.lastActiveDate === 'string'
            ? raw.preferences.lastActiveDate
            : todayKey,
        pomodoroMinutes:
          typeof raw.preferences.pomodoroMinutes === 'number'
            ? raw.preferences.pomodoroMinutes
            : 25,
      }
    : fallback.preferences

  return {
    version: APP_DATA_VERSION,
    focusTasks: focusTasks.length > 0 ? focusTasks : fallback.focusTasks,
    backlogTasks: backlogTasks.length > 0 ? backlogTasks : fallback.backlogTasks,
    rituals: rituals.length > 0 ? rituals : fallback.rituals,
    datePlans,
    events: events.length > 0 ? events : fallback.events,
    quotes: sanitizeQuotes(raw.quotes),
    preferences,
  }
}

function fromLegacyLocalStorage(reducedMotion: boolean): AppData | null {
  const todayKey = getTodayKey()
  const legacyFocus =
    parseJson<unknown>(localStorage.getItem('ldp_priority')) ??
    parseJson<unknown>(localStorage.getItem('liquidPriority'))
  const legacyBacklog =
    parseJson<unknown>(localStorage.getItem('ldp_todo')) ??
    parseJson<unknown>(localStorage.getItem('liquidTodo'))
  const legacyEvents =
    parseJson<unknown>(localStorage.getItem('ldp_events')) ??
    parseJson<unknown>(localStorage.getItem('liquidEvents'))
  const legacyRituals =
    parseJson<unknown>(localStorage.getItem('ldp_habits')) ??
    parseJson<unknown>(localStorage.getItem('liquid_repeat_v2'))

  const focusTasks = mapLegacyTasks(legacyFocus, 'focus')
  const backlogTasks = mapLegacyTasks(legacyBacklog, 'backlog')
  const rituals = mapLegacyRituals(legacyRituals)
  const events = mapLegacyEvents(legacyEvents)

  if (
    focusTasks.length === 0 &&
    backlogTasks.length === 0 &&
    rituals.length === 0 &&
    events.length === 0
  ) {
    return null
  }

  return {
    ...defaultAppData(todayKey, reducedMotion),
    focusTasks:
      focusTasks.length > 0 ? focusTasks : [createTask('安排今天最重要的一件事', 'focus')],
    backlogTasks:
      backlogTasks.length > 0 ? backlogTasks : [createTask('把旧事项移入这里继续整理', 'backlog')],
    rituals: rituals.length > 0 ? rituals : [createRitual('保留一条固定日常节律')],
    events,
  }
}

function rolloverCompletedFocusTasks(appData: AppData, todayKey: string): AppData {
  if (appData.preferences.lastActiveDate === todayKey) {
    return appData
  }

  return {
    ...appData,
    focusTasks: appData.focusTasks.filter((task) => !task.completed),
    preferences: {
      ...appData.preferences,
      lastActiveDate: todayKey,
    },
  }
}

export function loadAppData(): AppData {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const currentData =
    parseJson<unknown>(localStorage.getItem(APP_DATA_STORAGE_KEY)) ??
    parseJson<unknown>(localStorage.getItem(LEGACY_APP_DATA_STORAGE_KEY))
  const fromStorage = currentData ? sanitizeAppData(currentData, reducedMotion) : null
  const fromLegacy = fromStorage ? null : fromLegacyLocalStorage(reducedMotion)
  const appData = fromStorage ?? fromLegacy ?? defaultAppData(getTodayKey(), reducedMotion)
  return rolloverCompletedFocusTasks(appData, getTodayKey())
}

export function persistAppData(appData: AppData) {
  localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(appData))
}

export function exportAppData(appData: AppData) {
  const blob = new Blob([JSON.stringify(appData, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `flowish-${getTodayKey()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function importAppData(file: File): Promise<AppData> {
  const text = await file.text()
  const json = JSON.parse(text) as unknown
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return sanitizeAppData(json, reducedMotion)
}
