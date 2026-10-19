import {
  APP_DATA_STORAGE_KEY,
  APP_DATA_VERSION,
  DEFAULT_POMODORO_LONG_BREAK_INTERVAL,
  DEFAULT_POMODORO_LONG_BREAK_MINUTES,
  DEFAULT_POMODORO_MINUTES,
  DEFAULT_POMODORO_SHORT_BREAK_MINUTES,
  MAX_POMODORO_LONG_BREAK_INTERVAL,
  MAX_POMODORO_MINUTES,
  MIN_POMODORO_LONG_BREAK_INTERVAL,
  MIN_POMODORO_MINUTES,
  createEvent,
  createRitual,
  createTask,
  defaultAppData,
  type AppData,
  type DatePlan,
  type EventItem,
  type FocusTimeSlot,
  type Preferences,
  type Quote,
  type Ritual,
  type Task,
  type TaskBucket,
  type TaskPriority,
} from '../store/appData'
import { getTodayKey, isDateKey } from './date'
import { BUILTIN_QUOTES } from './quotes'

type UnknownRecord = Record<string, unknown>

export interface DecodeAppDataOptions {
  todayKey?: string
  reducedMotion?: boolean
}

interface ResolvedDecodeOptions {
  todayKey: string
  reducedMotion: boolean
}

const LEGACY_APP_DATA_STORAGE_KEY = 'liquid_dashboard_pro_app'
const LEGACY_FOCUS_KEYS = ['ldp_priority', 'liquidPriority'] as const
const LEGACY_BACKLOG_KEYS = ['ldp_todo', 'liquidTodo'] as const
const LEGACY_EVENT_KEYS = ['ldp_events', 'liquidEvents'] as const
const LEGACY_RITUAL_KEYS = ['ldp_habits', 'liquid_repeat_v2'] as const

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024
export const APP_DATA_RECOVERY_STORAGE_KEY = `${APP_DATA_STORAGE_KEY}_recovery`
export const APP_DATA_IMPORT_BACKUP_STORAGE_KEY = `${APP_DATA_STORAGE_KEY}_import_backup`

export interface LoadAppDataResult {
  data: AppData
  error: string | null
  persistenceAllowed: boolean
}

function parseJson(value: string | null): unknown | null {
  if (!value) return null

  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function resolveDecodeOptions(options: DecodeAppDataOptions = {}): ResolvedDecodeOptions {
  return {
    todayKey: isDateKey(options.todayKey) ? options.todayKey : getTodayKey(),
    reducedMotion: options.reducedMotion ?? false,
  }
}

function getSystemReducedMotion(): boolean {
  return typeof window !== 'undefined'
    ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    : false
}

function cloneBuiltinQuotes(): Quote[] {
  return BUILTIN_QUOTES.map((quote) => ({ ...quote }))
}

function normalizePriority(value: unknown): TaskPriority {
  return value === 'p1' || value === 'p2' || value === 'p3' ? value : null
}

function normalizeFocusTimeSlot(value: unknown): FocusTimeSlot | null {
  return value === 'morning' ||
    value === 'afternoon' ||
    value === 'evening' ||
    value === 'lateNight'
    ? value
    : null
}

function normalizeCompletionHistory(value: unknown): Record<string, true> {
  if (!isObject(value)) return {}

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, true] => isDateKey(entry[0]) && entry[1] === true,
    ),
  )
}

function decodeCollection<T>(
  raw: unknown,
  fallback: T[],
  decodeItem: (item: unknown) => T | null,
): T[] {
  if (!Array.isArray(raw)) return fallback
  return raw.map(decodeItem).filter((item): item is T => item !== null)
}

function decodeCurrentTask(raw: unknown, bucket: TaskBucket): Task | null {
  if (!isObject(raw)) return null
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text) return null

  const base = createTask(text, bucket, normalizePriority(raw.priority), {
    timeSlot: bucket === 'focus' ? normalizeFocusTimeSlot(raw.timeSlot) : null,
    dueDate: bucket === 'backlog' && isDateKey(raw.dueDate) ? raw.dueDate : null,
  })
  return {
    ...base,
    id: getNonEmptyString(raw.id) ?? base.id,
    completed: typeof raw.completed === 'boolean' ? raw.completed : false,
    createdAt: getNonEmptyString(raw.createdAt) ?? base.createdAt,
    updatedAt: getNonEmptyString(raw.updatedAt) ?? base.updatedAt,
  }
}

function decodeCurrentRitual(raw: unknown): Ritual | null {
  if (!isObject(raw)) return null
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text) return null

  const base = createRitual(text)
  return {
    ...base,
    id: getNonEmptyString(raw.id) ?? base.id,
    active: typeof raw.active === 'boolean' ? raw.active : true,
    completionHistory: normalizeCompletionHistory(raw.completionHistory),
    createdAt: getNonEmptyString(raw.createdAt) ?? base.createdAt,
    updatedAt: getNonEmptyString(raw.updatedAt) ?? base.updatedAt,
  }
}

function decodeCurrentEvent(raw: unknown): EventItem | null {
  if (!isObject(raw)) return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const date = isDateKey(raw.date) ? raw.date : null
  if (!title || !date) return null

  const type = raw.type === 'countup' || raw.type === 'annual' ? raw.type : 'countdown'
  const base = createEvent(title, date, type)
  return {
    ...base,
    id: getNonEmptyString(raw.id) ?? base.id,
    createdAt: getNonEmptyString(raw.createdAt) ?? base.createdAt,
  }
}

function decodeQuote(raw: unknown, index: number): Quote | null {
  if (!isObject(raw)) return null
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text) return null

  return {
    id: getNonEmptyString(raw.id) ?? `quote_import_${index}`,
    text,
    author:
      typeof raw.author === 'string' && raw.author.trim() ? raw.author.trim() : '佚名',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    source: raw.source === 'custom' ? 'custom' : 'builtin',
  }
}

function decodeQuotes(raw: unknown, mergeMissingBuiltins = false): Quote[] {
  if (!Array.isArray(raw)) return cloneBuiltinQuotes()

  const decoded = raw
    .map((item, index) => decodeQuote(item, index))
    .filter((quote): quote is Quote => quote !== null)

  if (decoded.length === 0) return cloneBuiltinQuotes()

  const decodedById = new Map(decoded.map((quote) => [quote.id, quote]))
  const builtinIds = new Set(BUILTIN_QUOTES.map((quote) => quote.id))
  const quotes = mergeMissingBuiltins
    ? [
        ...BUILTIN_QUOTES.map((builtin) => {
          const existing = decodedById.get(builtin.id)
          return existing
            ? { ...builtin, enabled: existing.enabled }
            : { ...builtin }
        }),
        ...decoded.filter((quote) => !builtinIds.has(quote.id)),
      ]
    : decoded

  if (quotes.some((quote) => quote.enabled)) return quotes

  return quotes.map((quote, index) => (index === 0 ? { ...quote, enabled: true } : quote))
}

function decodeDatePlans(
  raw: unknown,
  decodeTask: (item: unknown, bucket: TaskBucket) => Task | null,
): Record<string, DatePlan> {
  if (!isObject(raw)) return {}

  const plans: Record<string, DatePlan> = {}
  for (const [date, value] of Object.entries(raw)) {
    if (!isDateKey(date) || !isObject(value)) continue
    plans[date] = {
      date,
      tasks: decodeCollection(value.tasks, [], (item) => decodeTask(item, 'date')),
      note: typeof value.note === 'string' ? value.note : '',
    }
  }
  return plans
}

function decodePreferences(
  raw: unknown,
  fallback: Preferences,
  options: ResolvedDecodeOptions,
): Preferences {
  if (!isObject(raw)) return fallback

  const pomodoro = isObject(raw.pomodoro) ? raw.pomodoro : {}
  const pomodoroMinutes = pomodoro.focusMinutes ?? raw.pomodoroMinutes
  const validPomodoroMinutes =
    typeof pomodoroMinutes === 'number' &&
    Number.isInteger(pomodoroMinutes) &&
    pomodoroMinutes >= MIN_POMODORO_MINUTES &&
    pomodoroMinutes <= MAX_POMODORO_MINUTES
  const shortBreakMinutes = pomodoro.shortBreakMinutes
  const validShortBreakMinutes =
    typeof shortBreakMinutes === 'number' &&
    Number.isInteger(shortBreakMinutes) &&
    shortBreakMinutes >= MIN_POMODORO_MINUTES &&
    shortBreakMinutes <= MAX_POMODORO_MINUTES
  const longBreakMinutes = pomodoro.longBreakMinutes
  const validLongBreakMinutes =
    typeof longBreakMinutes === 'number' &&
    Number.isInteger(longBreakMinutes) &&
    longBreakMinutes >= MIN_POMODORO_MINUTES &&
    longBreakMinutes <= MAX_POMODORO_MINUTES
  const longBreakInterval = pomodoro.roundsPerCycle
  const validLongBreakInterval =
    typeof longBreakInterval === 'number' &&
    Number.isInteger(longBreakInterval) &&
    longBreakInterval >= MIN_POMODORO_LONG_BREAK_INTERVAL &&
    longBreakInterval <= MAX_POMODORO_LONG_BREAK_INTERVAL

  return {
    soundEnabled:
      typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : fallback.soundEnabled,
    theme: raw.theme === 'obsidian' || raw.theme === 'pearl' ? raw.theme : fallback.theme,
    reducedMotion:
      typeof raw.reducedMotion === 'boolean'
        ? raw.reducedMotion
        : options.reducedMotion,
    quoteMode:
      raw.quoteMode === 'random' || raw.quoteMode === 'daily'
        ? raw.quoteMode
        : fallback.quoteMode,
    calendarExpandedDefault:
      typeof raw.calendarExpandedDefault === 'boolean'
        ? raw.calendarExpandedDefault
        : fallback.calendarExpandedDefault,
    lastActiveDate: isDateKey(raw.lastActiveDate)
      ? raw.lastActiveDate
      : options.todayKey,
    pomodoro: {
      focusMinutes: validPomodoroMinutes
        ? pomodoroMinutes
        : DEFAULT_POMODORO_MINUTES,
      shortBreakMinutes: validShortBreakMinutes
        ? shortBreakMinutes
        : DEFAULT_POMODORO_SHORT_BREAK_MINUTES,
      longBreakMinutes: validLongBreakMinutes
        ? longBreakMinutes
        : DEFAULT_POMODORO_LONG_BREAK_MINUTES,
      roundsPerCycle: validLongBreakInterval
        ? longBreakInterval
        : DEFAULT_POMODORO_LONG_BREAK_INTERVAL,
    },
  }
}

export function decodeCurrentAppData(
  raw: unknown,
  options: DecodeAppDataOptions = {},
): AppData {
  const resolved = resolveDecodeOptions(options)
  const fallback = defaultAppData(resolved.todayKey, resolved.reducedMotion)
  if (!isObject(raw)) return fallback

  return {
    version: APP_DATA_VERSION,
    focusTasks: decodeCollection(raw.focusTasks, fallback.focusTasks, (item) =>
      decodeCurrentTask(item, 'focus'),
    ),
    backlogTasks: decodeCollection(raw.backlogTasks, fallback.backlogTasks, (item) =>
      decodeCurrentTask(item, 'backlog'),
    ),
    rituals: decodeCollection(raw.rituals, fallback.rituals, decodeCurrentRitual),
    datePlans: decodeDatePlans(raw.datePlans, decodeCurrentTask),
    events: decodeCollection(raw.events, fallback.events, decodeCurrentEvent),
    quotes: decodeQuotes(raw.quotes),
    preferences: decodePreferences(raw.preferences, fallback.preferences, resolved),
  }
}

function decodeLegacyTask(raw: unknown, bucket: TaskBucket): Task | null {
  if (!isObject(raw)) return null
  const task = decodeCurrentTask(raw, bucket)
  if (!task) return null
  return {
    ...task,
    completed: Boolean(raw.completed),
  }
}

function decodeLegacyRitual(raw: unknown): Ritual | null {
  if (!isObject(raw)) return null
  const text =
    typeof raw.text === 'string'
      ? raw.text.trim()
      : typeof raw.name === 'string'
        ? raw.name.trim()
        : ''
  if (!text) return null

  const base = createRitual(text)
  const completionHistory = normalizeCompletionHistory(raw.completionHistory)
  if (isDateKey(raw.lastDone)) completionHistory[raw.lastDone] = true

  return {
    ...base,
    id: getNonEmptyString(raw.id) ?? base.id,
    active: typeof raw.active === 'boolean' ? raw.active : true,
    completionHistory,
    createdAt: getNonEmptyString(raw.createdAt) ?? base.createdAt,
    updatedAt: getNonEmptyString(raw.updatedAt) ?? base.updatedAt,
  }
}

function decodeLegacyEvent(raw: unknown): EventItem | null {
  if (!isObject(raw)) return null
  const title =
    typeof raw.title === 'string'
      ? raw.title.trim()
      : typeof raw.name === 'string'
        ? raw.name.trim()
        : ''
  const date = isDateKey(raw.date) ? raw.date : null
  if (!title || !date) return null

  const type =
    raw.type === 'annual'
      ? 'annual'
      : raw.type === 'countup' || raw.type === 'custom'
        ? 'countup'
        : 'countdown'
  const base = createEvent(title, date, type)
  return {
    ...base,
    id: getNonEmptyString(raw.id) ?? base.id,
    createdAt: getNonEmptyString(raw.createdAt) ?? base.createdAt,
  }
}

export function migrateLegacyAppData(
  raw: unknown,
  options: DecodeAppDataOptions = {},
): AppData {
  const resolved = resolveDecodeOptions(options)
  const fallback = defaultAppData(resolved.todayKey, resolved.reducedMotion)
  if (!isObject(raw)) return fallback

  return {
    version: APP_DATA_VERSION,
    focusTasks: decodeCollection(raw.focusTasks, fallback.focusTasks, (item) =>
      decodeLegacyTask(item, 'focus'),
    ),
    backlogTasks: decodeCollection(raw.backlogTasks, fallback.backlogTasks, (item) =>
      decodeLegacyTask(item, 'backlog'),
    ),
    rituals: decodeCollection(raw.rituals, fallback.rituals, decodeLegacyRitual),
    datePlans: decodeDatePlans(raw.datePlans, decodeLegacyTask),
    events: decodeCollection(raw.events, fallback.events, decodeLegacyEvent),
    quotes: decodeQuotes(raw.quotes, true),
    preferences: decodePreferences(raw.preferences, fallback.preferences, resolved),
  }
}

export function decodeAppData(
  raw: unknown,
  options: DecodeAppDataOptions = {},
): AppData {
  if (!isObject(raw)) {
    const resolved = resolveDecodeOptions(options)
    return defaultAppData(resolved.todayKey, resolved.reducedMotion)
  }

  if (raw.version === APP_DATA_VERSION && !isCompleteCurrentAppData(raw)) {
    throw new Error('当前版本的数据结构不完整。')
  }

  if (hasDuplicateIdentifiers(raw)) {
    throw new Error('数据中存在重复项目标识。')
  }

  let decoded: AppData
  if (raw.version === APP_DATA_VERSION) {
    decoded = decodeCurrentAppData(raw, options)
  } else if (typeof raw.version === 'number' && raw.version > APP_DATA_VERSION) {
    throw new Error('数据版本高于当前应用支持的版本，请先更新 Flowish。')
  } else {
    decoded = migrateLegacyAppData(raw, options)
  }

  if (hasDuplicateAppDataIdentifiers(decoded)) {
    throw new Error('数据中存在重复项目标识。')
  }

  return decoded
}

export function decodeStoredAppData(
  raw: unknown,
  options: DecodeAppDataOptions = {},
): AppData {
  if (!looksLikeAppData(raw)) {
    throw new Error('数据内容不是 Flowish 数据。')
  }
  return decodeAppData(raw, options)
}

function readFirstLegacyValue(keys: readonly string[]): unknown | null {
  for (const key of keys) {
    const value = parseJson(localStorage.getItem(key))
    if (value !== null) return value
  }
  return null
}

function fromLegacyLocalStorage(options: ResolvedDecodeOptions): AppData | null {
  const focusTasks = decodeCollection(
    readFirstLegacyValue(LEGACY_FOCUS_KEYS),
    [],
    (item) => decodeLegacyTask(item, 'focus'),
  )
  const backlogTasks = decodeCollection(
    readFirstLegacyValue(LEGACY_BACKLOG_KEYS),
    [],
    (item) => decodeLegacyTask(item, 'backlog'),
  )
  const rituals = decodeCollection(
    readFirstLegacyValue(LEGACY_RITUAL_KEYS),
    [],
    decodeLegacyRitual,
  )
  const events = decodeCollection(
    readFirstLegacyValue(LEGACY_EVENT_KEYS),
    [],
    decodeLegacyEvent,
  )

  if (
    focusTasks.length === 0 &&
    backlogTasks.length === 0 &&
    rituals.length === 0 &&
    events.length === 0
  ) {
    return null
  }

  return {
    ...defaultAppData(options.todayKey, options.reducedMotion),
    focusTasks:
      focusTasks.length > 0
        ? focusTasks
        : [createTask('安排今天最重要的一件事', 'focus')],
    backlogTasks:
      backlogTasks.length > 0
        ? backlogTasks
        : [createTask('把旧事项移入这里继续整理', 'backlog')],
    rituals:
      rituals.length > 0 ? rituals : [createRitual('保留一条固定日常节律')],
    events,
  }
}

export function rolloverCompletedFocusTasks(appData: AppData, todayKey: string): AppData {
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

function recoverCurrentData(
  raw: string,
  options: ResolvedDecodeOptions,
  reason: 'damaged' | 'future',
): LoadAppDataResult {
  const recoverySaved = saveRecoveryCopy(raw)

  const error = recoverySaved
    ? reason === 'future'
      ? '本地数据来自更新版本，已保留恢复副本；请更新 Flowish 后再试。'
      : '本地数据损坏，已保留恢复副本并载入默认数据。'
    : '本地数据无法读取，且无法保存恢复副本；原数据未被覆盖，当前修改暂时不会保存。'

  return {
    data: defaultAppData(options.todayKey, options.reducedMotion),
    error,
    persistenceAllowed: recoverySaved,
  }
}

function saveRecoveryCopy(raw: string): boolean {
  try {
    localStorage.setItem(APP_DATA_RECOVERY_STORAGE_KEY, raw)
    return true
  } catch {
    // Keep the original key untouched when a recovery copy cannot be written.
    return false
  }
}

function recoverNormalizedCurrentData(raw: string, data: AppData): LoadAppDataResult {
  const recoverySaved = saveRecoveryCopy(raw)

  return {
    data,
    error: recoverySaved
      ? '本地数据存在异常，已保留恢复副本并修复可用内容。'
      : '本地数据存在异常，且无法保存恢复副本；原数据未被覆盖，当前修改暂时不会保存。',
    persistenceAllowed: recoverySaved,
  }
}

export function loadAppDataWithStatus(): LoadAppDataResult {
  const options = resolveDecodeOptions({
    todayKey: getTodayKey(),
    reducedMotion: getSystemReducedMotion(),
  })

  let currentRaw: string | null
  try {
    currentRaw = localStorage.getItem(APP_DATA_STORAGE_KEY)
  } catch {
    return {
      data: defaultAppData(options.todayKey, options.reducedMotion),
      error: '无法读取浏览器本地数据，当前修改暂时不会保存。',
      persistenceAllowed: false,
    }
  }

  if (currentRaw !== null) {
    let currentData: unknown
    try {
      currentData = JSON.parse(currentRaw) as unknown
    } catch {
      return recoverCurrentData(currentRaw, options, 'damaged')
    }

    try {
      const decoded = decodeStoredAppData(currentData, options)
      const data = rolloverCompletedFocusTasks(decoded, options.todayKey)

      if (
        isObject(currentData) &&
        currentData.version === APP_DATA_VERSION &&
        currentDataNeedsRepair(currentData, decoded)
      ) {
        return recoverNormalizedCurrentData(currentRaw, data)
      }

      return {
        data,
        error: null,
        persistenceAllowed: true,
      }
    } catch {
      const isFutureVersion =
        isObject(currentData) &&
        typeof currentData.version === 'number' &&
        currentData.version > APP_DATA_VERSION
      return recoverCurrentData(
        currentRaw,
        options,
        isFutureVersion ? 'future' : 'damaged',
      )
    }
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_APP_DATA_STORAGE_KEY)
    const legacyAppData = parseJson(legacyRaw)
    const fromStorage =
      legacyAppData !== null ? migrateLegacyAppData(legacyAppData, options) : null
    const fromLegacy = fromStorage ? null : fromLegacyLocalStorage(options)
    const appData =
      fromStorage ??
      fromLegacy ??
      defaultAppData(options.todayKey, options.reducedMotion)
    return {
      data: rolloverCompletedFocusTasks(appData, options.todayKey),
      error: null,
      persistenceAllowed: true,
    }
  } catch {
    return {
      data: defaultAppData(options.todayKey, options.reducedMotion),
      error: '无法读取浏览器本地数据，当前修改暂时不会保存。',
      persistenceAllowed: false,
    }
  }
}

export function persistAppData(appData: AppData) {
  localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(appData))
}

export function backupAppDataBeforeImport(appData: AppData) {
  try {
    localStorage.setItem(APP_DATA_IMPORT_BACKUP_STORAGE_KEY, JSON.stringify(appData))
  } catch {
    throw new Error('导入失败：无法备份当前数据，请先手动导出。')
  }
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

function looksLikeAppData(value: unknown): value is UnknownRecord {
  if (!isObject(value)) return false
  return [
    'version',
    'focusTasks',
    'backlogTasks',
    'rituals',
    'datePlans',
    'events',
    'quotes',
    'preferences',
  ].some((key) => Object.hasOwn(value, key))
}

function isCompleteCurrentAppData(value: UnknownRecord): boolean {
  return (
    value.version === APP_DATA_VERSION &&
    Array.isArray(value.focusTasks) &&
    Array.isArray(value.backlogTasks) &&
    Array.isArray(value.rituals) &&
    isObject(value.datePlans) &&
    Array.isArray(value.events) &&
    Array.isArray(value.quotes) &&
    isObject(value.preferences)
  )
}

function hasSameDataShape(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => hasSameDataShape(item, right[index]))
    )
  }

  if (!isObject(left) || !isObject(right)) return false

  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && hasSameDataShape(left[key], right[key]),
    )
  )
}

function currentDataNeedsRepair(raw: UnknownRecord, decoded: AppData): boolean {
  return !hasSameDataShape(raw, decoded)
}

function hasDuplicateIdentifiers(value: UnknownRecord): boolean {
  const seen = new Set<string>()
  const collections: unknown[] = [
    value.focusTasks,
    value.backlogTasks,
    value.rituals,
    value.events,
    value.quotes,
  ]

  if (isObject(value.datePlans)) {
    for (const plan of Object.values(value.datePlans)) {
      if (isObject(plan)) collections.push(plan.tasks)
    }
  }

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue
    for (const item of collection) {
      if (!isObject(item)) continue
      const id = getNonEmptyString(item.id)
      if (!id) continue
      if (seen.has(id)) return true
      seen.add(id)
    }
  }

  return false
}

function hasDuplicateAppDataIdentifiers(value: AppData): boolean {
  const seen = new Set<string>()
  const collections: Array<ReadonlyArray<{ id: string }>> = [
    value.focusTasks,
    value.backlogTasks,
    value.rituals,
    value.events,
    value.quotes,
    ...Object.values(value.datePlans).map((plan) => plan.tasks),
  ]

  for (const collection of collections) {
    for (const item of collection) {
      if (seen.has(item.id)) return true
      seen.add(item.id)
    }
  }

  return false
}

export async function importAppData(file: File): Promise<AppData> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('导入失败：文件不能超过 5 MB。')
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    throw new Error('导入失败：无法读取这个文件。')
  }

  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new Error('导入失败：文件不能超过 5 MB。')
  }

  let json: unknown
  try {
    json = JSON.parse(text) as unknown
  } catch {
    throw new Error('导入失败：文件不是有效的 JSON。')
  }

  if (!looksLikeAppData(json)) {
    throw new Error('导入失败：文件内容不是 Flowish 数据。')
  }

  if (json.version === APP_DATA_VERSION && !isCompleteCurrentAppData(json)) {
    throw new Error('导入失败：当前版本的数据结构不完整。')
  }

  if (hasDuplicateIdentifiers(json)) {
    throw new Error('导入失败：数据中存在重复项目标识。')
  }

  try {
    const todayKey = getTodayKey()
    const decoded = decodeStoredAppData(json, {
      todayKey,
      reducedMotion: getSystemReducedMotion(),
    })
    if (json.version === APP_DATA_VERSION && currentDataNeedsRepair(json, decoded)) {
      throw new Error('当前版本的数据包含无效或缺失字段。')
    }
    return rolloverCompletedFocusTasks(decoded, todayKey)
  } catch (error) {
    const reason = error instanceof Error ? error.message : '数据无法解析。'
    throw new Error(`导入失败：${reason}`)
  }
}
