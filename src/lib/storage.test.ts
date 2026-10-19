import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  APP_DATA_STORAGE_KEY,
  APP_DATA_VERSION,
  type AppData,
} from '../store/appData'
import {
  APP_DATA_IMPORT_BACKUP_STORAGE_KEY,
  APP_DATA_RECOVERY_STORAGE_KEY,
  MAX_IMPORT_FILE_BYTES,
  backupAppDataBeforeImport,
  decodeAppData,
  importAppData,
  loadAppDataWithStatus,
} from './storage'
import { getTodayKey, toDateKey } from './date'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

const canonicalData = (): AppData => ({
  version: APP_DATA_VERSION,
  focusTasks: [],
  backlogTasks: [],
  rituals: [
    {
      id: 'ritual_keep',
      text: '晚间复盘',
      active: false,
      completionHistory: {
        '2026-07-11': true,
        '2026-07-12': true,
      },
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-12T08:00:00.000Z',
    },
  ],
  datePlans: {
    '2026-07-15': {
      date: '2026-07-15',
      note: '准备发布',
      tasks: [
        {
          id: 'date_keep',
          text: '检查发布清单',
          completed: true,
          createdAt: '2026-07-02T08:00:00.000Z',
          updatedAt: '2026-07-14T08:00:00.000Z',
          bucket: 'date',
          priority: 'p1',
          timeSlot: null,
          dueDate: null,
        },
      ],
    },
  },
  events: [],
  quotes: [
    {
      id: 'quote_keep',
      text: '先完成，再完善。',
      author: 'Flowish',
      enabled: true,
      source: 'custom',
    },
  ],
  preferences: {
    soundEnabled: true,
    theme: 'obsidian',
    reducedMotion: true,
    quoteMode: 'random',
    calendarExpandedDefault: true,
    lastActiveDate: '2026-07-13',
    pomodoro: {
      focusMinutes: 45,
      shortBreakMinutes: 8,
      longBreakMinutes: 20,
      roundsPerCycle: 4,
    },
  },
})

describe('decodeAppData', () => {
  it('migrates v1 task scheduling fields without inventing dates or time periods', () => {
    const decoded = decodeAppData(
      {
        ...canonicalData(),
        version: 1,
        focusTasks: [{ text: '旧重点', completed: false }],
        backlogTasks: [{ text: '旧积压', completed: false }],
      },
      { todayKey: '2026-07-14' },
    )

    expect(decoded.version).toBe(APP_DATA_VERSION)
    expect(decoded.focusTasks[0]).toMatchObject({
      text: '旧重点',
      timeSlot: null,
      dueDate: null,
    })
    expect(decoded.backlogTasks[0]).toMatchObject({
      text: '旧积压',
      timeSlot: null,
      dueDate: null,
    })
  })

  it('round-trips current v2 data without replacing empty collections or metadata', () => {
    const source = canonicalData()

    expect(
      decodeAppData(JSON.parse(JSON.stringify(source)), {
        todayKey: '2026-07-13',
        reducedMotion: false,
      }),
    ).toEqual(source)
  })

  it('keeps current ritual history, active state, identifiers, and timestamps', () => {
    const decoded = decodeAppData(canonicalData(), { todayKey: '2026-07-13' })

    expect(decoded.rituals[0]).toEqual(canonicalData().rituals[0])
    expect(decoded.datePlans['2026-07-15']?.tasks[0]).toEqual(
      canonicalData().datePlans['2026-07-15']?.tasks[0],
    )
  })

  it('keeps every legal empty collection empty', () => {
    const source = {
      ...canonicalData(),
      rituals: [],
      datePlans: {},
    }

    const decoded = decodeAppData(source, { todayKey: '2026-07-13' })

    expect(decoded.focusTasks).toEqual([])
    expect(decoded.backlogTasks).toEqual([])
    expect(decoded.rituals).toEqual([])
    expect(decoded.events).toEqual([])
    expect(decoded.datePlans).toEqual({})
  })

  it('normalizes invalid preferences and always leaves an enabled quote', () => {
    const source = canonicalData()
    const decoded = decodeAppData(
      {
        ...source,
        quotes: source.quotes.map((quote) => ({ ...quote, enabled: false })),
        preferences: {
          ...source.preferences,
          theme: 'unknown',
          quoteMode: 'shuffle',
          lastActiveDate: '2026-02-30',
          pomodoro: {
            focusMinutes: Number.POSITIVE_INFINITY,
            shortBreakMinutes: 0,
            longBreakMinutes: 999,
            roundsPerCycle: 1,
          },
        },
      },
      { todayKey: '2026-07-13', reducedMotion: false },
    )

    expect(decoded.quotes.some((quote) => quote.enabled)).toBe(true)
    expect(decoded.preferences).toMatchObject({
      theme: 'pearl',
      quoteMode: 'daily',
      lastActiveDate: '2026-07-13',
      pomodoro: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        roundsPerCycle: 4,
      },
    })
  })

  it('migrates versionless legacy fields without using the current v1 codec', () => {
    const decoded = decodeAppData(
      {
        focusTasks: [{ text: '旧重点', completed: true }],
        backlogTasks: [],
        rituals: [{ name: '旧节律', lastDone: '2026-07-12' }],
        events: [{ name: '旧事件', date: '2026-08-01', type: 'custom' }],
      },
      { todayKey: '2026-07-13' },
    )

    expect(decoded.version).toBe(APP_DATA_VERSION)
    expect(decoded.focusTasks[0]).toMatchObject({ text: '旧重点', completed: true, bucket: 'focus' })
    expect(decoded.backlogTasks).toEqual([])
    expect(decoded.rituals[0]?.completionHistory).toEqual({ '2026-07-12': true })
    expect(decoded.events[0]).toMatchObject({ title: '旧事件', type: 'countup' })
  })

  it('drops malformed collection entries instead of restoring sample data', () => {
    const source = {
      ...canonicalData(),
      focusTasks: [{ id: 'broken', text: '', completed: true }],
      rituals: [null, { text: '   ' }],
      events: [{ title: '无效日期', date: '2026-02-30', type: 'countdown' }],
      datePlans: {
        '2026-02-30': { date: '2026-02-30', tasks: [], note: '无效' },
      },
    }

    const decoded = decodeAppData(source, { todayKey: '2026-07-13' })

    expect(decoded.focusTasks).toEqual([])
    expect(decoded.rituals).toEqual([])
    expect(decoded.events).toEqual([])
    expect(decoded.datePlans).toEqual({})
  })
})

describe('importAppData', () => {
  it('preserves the current data before a valid import can replace it', () => {
    const current = canonicalData()

    backupAppDataBeforeImport(current)

    expect(localStorage.getItem(APP_DATA_IMPORT_BACKUP_STORAGE_KEY)).toBe(
      JSON.stringify(current),
    )
  })

  it('blocks replacement when the current data cannot be preserved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === APP_DATA_IMPORT_BACKUP_STORAGE_KEY) {
        throw new DOMException('full', 'QuotaExceededError')
      }
    })

    expect(() => backupAppDataBeforeImport(canonicalData())).toThrow(
      '导入失败：无法备份当前数据，请先手动导出。',
    )
  })

  it('rejects an incomplete current-version backup before it can replace user data', async () => {
    const text = JSON.stringify({ version: APP_DATA_VERSION })
    const file = {
      size: text.length,
      text: async () => text,
    } as File

    await expect(importAppData(file)).rejects.toThrow(
      '导入失败：当前版本的数据结构不完整。',
    )
  })

  it('rejects current-version data that would lose or repair fields during decoding', async () => {
    const source = canonicalData()
    source.focusTasks = [
      {
        ...source.datePlans['2026-07-15'].tasks[0],
        id: 'focus_broken',
        text: '   ',
        bucket: 'focus',
      },
    ]
    ;(source.preferences as unknown as { theme: string }).theme = 'unknown'
    const text = JSON.stringify(source)
    const file = {
      size: text.length,
      text: async () => text,
    } as File

    await expect(importAppData(file)).rejects.toThrow(
      '导入失败：当前版本的数据包含无效或缺失字段。',
    )
  })

  it('rejects unknown current-version fields that would be discarded', async () => {
    const source = canonicalData()
    ;(source.rituals[0] as unknown as Record<string, unknown>).legacyFlag = true
    const text = JSON.stringify(source)
    const file = {
      size: text.length,
      text: async () => text,
    } as File

    await expect(importAppData(file)).rejects.toThrow(
      '导入失败：当前版本的数据包含无效或缺失字段。',
    )
  })

  it('rejects duplicate identifiers across all current-version collections', async () => {
    const source = canonicalData()
    source.quotes[0].id = source.rituals[0].id
    const text = JSON.stringify(source)
    const file = {
      size: text.length,
      text: async () => text,
    } as File

    await expect(importAppData(file)).rejects.toThrow(
      '导入失败：数据中存在重复项目标识。',
    )
  })

  it('rejects identifiers that collide after missing values are normalized', async () => {
    const source = canonicalData()
    source.rituals[0].id = 'quote_import_0'
    delete (source.quotes[0] as Partial<AppData['quotes'][number]>).id
    const text = JSON.stringify(source)
    const file = {
      size: text.length,
      text: async () => text,
    } as File

    await expect(importAppData(file)).rejects.toThrow(
      '导入失败：数据中存在重复项目标识。',
    )
  })

  it('applies the current-day rollover before returning imported data', async () => {
    const source = canonicalData()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    source.preferences.lastActiveDate = toDateKey(yesterday)
    source.focusTasks = [
      {
        ...source.datePlans['2026-07-15'].tasks[0],
        id: 'focus_completed_yesterday',
        bucket: 'focus',
        completed: true,
      },
    ]
    const text = JSON.stringify(source)
    const file = {
      size: text.length,
      text: async () => text,
    } as File

    const imported = await importAppData(file)

    expect(imported.focusTasks).toEqual([])
    expect(imported.preferences.lastActiveDate).toBe(getTodayKey())
  })

  it('reports invalid JSON with a natural Chinese error', async () => {
    const file = {
      size: 8,
      text: async () => '{broken',
    } as File

    await expect(importAppData(file)).rejects.toThrow('导入失败：文件不是有效的 JSON。')
  })

  it('rejects files larger than the import limit before reading them', async () => {
    let read = false
    const file = {
      size: MAX_IMPORT_FILE_BYTES + 1,
      text: async () => {
        read = true
        return '{}'
      },
    } as File

    await expect(importAppData(file)).rejects.toThrow('导入失败：文件不能超过 5 MB。')
    expect(read).toBe(false)
  })

  it('rejects valid JSON that is not Flowish data', async () => {
    const file = {
      size: 18,
      text: async () => '{"hello":"world"}',
    } as File

    await expect(importAppData(file)).rejects.toThrow('导入失败：文件内容不是 Flowish 数据。')
  })
})

describe('loadAppDataWithStatus', () => {
  it('keeps a recovery copy when current data needs lossy repairs', () => {
    const source = canonicalData()
    source.focusTasks = [
      {
        ...source.datePlans['2026-07-15'].tasks[0],
        id: 'focus_keep',
        text: '保留这条重点',
        bucket: 'focus',
        completed: false,
      },
      {
        ...source.datePlans['2026-07-15'].tasks[0],
        id: 'focus_broken',
        text: '   ',
        bucket: 'focus',
      },
    ]
    ;(source.preferences as unknown as { theme: string }).theme = 'unknown'
    const raw = JSON.stringify(source)
    localStorage.setItem(APP_DATA_STORAGE_KEY, raw)

    const result = loadAppDataWithStatus()

    expect(result.data.focusTasks.map((task) => task.id)).toEqual(['focus_keep'])
    expect(result.data.preferences.theme).toBe('pearl')
    expect(result.error).toBe('本地数据存在异常，已保留恢复副本并修复可用内容。')
    expect(result.persistenceAllowed).toBe(true)
    expect(localStorage.getItem(APP_DATA_RECOVERY_STORAGE_KEY)).toBe(raw)
    expect(localStorage.getItem(APP_DATA_STORAGE_KEY)).toBe(raw)
  })

  it('keeps a recovery copy before falling back from malformed current data', () => {
    const malformed = '{"version":1,"focusTasks":['
    localStorage.setItem(APP_DATA_STORAGE_KEY, malformed)

    const result = loadAppDataWithStatus()

    expect(result.data.version).toBe(APP_DATA_VERSION)
    expect(result.error).toBe('本地数据损坏，已保留恢复副本并载入默认数据。')
    expect(result.persistenceAllowed).toBe(true)
    expect(localStorage.getItem(APP_DATA_RECOVERY_STORAGE_KEY)).toBe(malformed)
    expect(localStorage.getItem(APP_DATA_STORAGE_KEY)).toBe(malformed)
  })

  it('keeps a recovery copy and returns defaults for a future data version', () => {
    const source = { ...canonicalData(), version: APP_DATA_VERSION + 1 }
    const raw = JSON.stringify(source)
    localStorage.setItem(APP_DATA_STORAGE_KEY, raw)

    const result = loadAppDataWithStatus()

    expect(result.data.version).toBe(APP_DATA_VERSION)
    expect(result.error).toBe('本地数据来自更新版本，已保留恢复副本；请更新 Flowish 后再试。')
    expect(result.persistenceAllowed).toBe(true)
    expect(localStorage.getItem(APP_DATA_RECOVERY_STORAGE_KEY)).toBe(raw)
    expect(localStorage.getItem(APP_DATA_STORAGE_KEY)).toBe(raw)
  })

  it('returns safe defaults and blocks persistence when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    const result = loadAppDataWithStatus()

    expect(result.data.version).toBe(APP_DATA_VERSION)
    expect(result.error).toBe('无法读取浏览器本地数据，当前修改暂时不会保存。')
    expect(result.persistenceAllowed).toBe(false)
  })

  it('keeps the original key untouched when a recovery copy cannot be saved', () => {
    const malformed = '{"version":1,"quotes":['
    localStorage.setItem(APP_DATA_STORAGE_KEY, malformed)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === APP_DATA_RECOVERY_STORAGE_KEY) {
        throw new DOMException('full', 'QuotaExceededError')
      }
    })

    const result = loadAppDataWithStatus()

    expect(result.persistenceAllowed).toBe(false)
    expect(result.error).toBe(
      '本地数据无法读取，且无法保存恢复副本；原数据未被覆盖，当前修改暂时不会保存。',
    )
    expect(localStorage.getItem(APP_DATA_STORAGE_KEY)).toBe(malformed)
  })
})
