import { BUILTIN_QUOTES } from '../lib/quotes'

export const APP_DATA_VERSION = 2
export const APP_DATA_STORAGE_KEY = 'flowish_app'
export const DEFAULT_POMODORO_MINUTES = 25
export const DEFAULT_POMODORO_SHORT_BREAK_MINUTES = 5
export const DEFAULT_POMODORO_LONG_BREAK_MINUTES = 15
export const DEFAULT_POMODORO_LONG_BREAK_INTERVAL = 4
export const MIN_POMODORO_MINUTES = 1
export const MAX_POMODORO_MINUTES = 180
export const MIN_POMODORO_LONG_BREAK_INTERVAL = 2
export const MAX_POMODORO_LONG_BREAK_INTERVAL = 12

export type TaskBucket = 'focus' | 'backlog' | 'date'
export type ThemeMode = 'pearl' | 'obsidian'
export type QuoteMode = 'daily' | 'random'
export type TaskPriority = 'p1' | 'p2' | 'p3' | null
export type FocusTimeSlot = 'morning' | 'afternoon' | 'evening' | 'lateNight'

export interface TaskSchedule {
  timeSlot?: FocusTimeSlot | null
  dueDate?: string | null
}

export interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: string
  updatedAt: string
  bucket: TaskBucket
  priority: TaskPriority
  timeSlot: FocusTimeSlot | null
  dueDate: string | null
}

export interface Ritual {
  id: string
  text: string
  active: boolean
  completionHistory: Record<string, true>
  createdAt: string
  updatedAt: string
}

export interface DatePlan {
  date: string
  tasks: Task[]
  note: string
}

export interface EventItem {
  id: string
  title: string
  date: string
  type: 'countdown' | 'countup' | 'annual'
  createdAt: string
}

export interface Quote {
  id: string
  text: string
  author: string
  enabled: boolean
  source: 'builtin' | 'custom'
}

export interface PomodoroConfig {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  roundsPerCycle: number
}

export interface Preferences {
  soundEnabled: boolean
  theme: ThemeMode
  reducedMotion: boolean
  quoteMode: QuoteMode
  calendarExpandedDefault: boolean
  lastActiveDate: string
  pomodoro: PomodoroConfig
}

export interface AppData {
  version: number
  focusTasks: Task[]
  backlogTasks: Task[]
  rituals: Ritual[]
  datePlans: Record<string, DatePlan>
  events: EventItem[]
  quotes: Quote[]
  preferences: Preferences
}

export const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const makeTimestamp = () => new Date().toISOString()

export const createTask = (
  text: string,
  bucket: TaskBucket,
  priority: TaskPriority = null,
  schedule: TaskSchedule = {},
): Task => {
  const timestamp = makeTimestamp()
  return {
    id: createId(bucket),
    text,
    completed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    bucket,
    priority,
    timeSlot: bucket === 'focus' ? schedule.timeSlot ?? null : null,
    dueDate: bucket === 'backlog' ? schedule.dueDate ?? null : null,
  }
}

export const createRitual = (text: string): Ritual => {
  const timestamp = makeTimestamp()
  return {
    id: createId('ritual'),
    text,
    active: true,
    completionHistory: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const createEvent = (
  title: string,
  date: string,
  type: EventItem['type'] = 'countdown',
): EventItem => ({
  id: createId('event'),
  title,
  date,
  type,
  createdAt: makeTimestamp(),
})

export const defaultAppData = (todayKey: string, reducedMotion = false): AppData => ({
  version: APP_DATA_VERSION,
  focusTasks: [
    createTask('打磨今天最重要的 3 件事', 'focus', 'p1', { timeSlot: 'morning' }),
    createTask('把一个积压事项推进到可交付状态', 'focus', 'p2', { timeSlot: 'afternoon' }),
  ],
  backlogTasks: [
    createTask('整理灵感、链接与临时想法', 'backlog'),
    createTask('为本周计划补一条具体行动', 'backlog'),
  ],
  rituals: [
    createRitual('晨间规划 10 分钟'),
    createRitual('写下今日重点与节奏'),
    createRitual('睡前回顾与重排未完成项'),
  ],
  datePlans: {},
  events: [
    createEvent('月度复盘', todayKey, 'countup'),
    createEvent('项目里程碑', shiftDateKey(todayKey, 12), 'countdown'),
  ],
  quotes: BUILTIN_QUOTES.map((quote) => ({ ...quote })),
  preferences: {
    soundEnabled: false,
    theme: 'pearl',
    reducedMotion,
    quoteMode: 'daily',
    calendarExpandedDefault: false,
    lastActiveDate: todayKey,
    pomodoro: {
      focusMinutes: DEFAULT_POMODORO_MINUTES,
      shortBreakMinutes: DEFAULT_POMODORO_SHORT_BREAK_MINUTES,
      longBreakMinutes: DEFAULT_POMODORO_LONG_BREAK_MINUTES,
      roundsPerCycle: DEFAULT_POMODORO_LONG_BREAK_INTERVAL,
    },
  },
})

function shiftDateKey(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + delta)
  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}
