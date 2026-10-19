import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_DATA_STORAGE_KEY, APP_DATA_VERSION, createTask, defaultAppData } from './appData'
import { reduceAppData, useFlowishApp } from './useFlowishApp'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.querySelector("meta[name='theme-color']")?.remove()
})

describe('reduceAppData quote invariants', () => {
  it('keeps the last enabled quote enabled', () => {
    const data = defaultAppData('2026-07-13')
    data.quotes = data.quotes.map((quote, index) => ({
      ...quote,
      enabled: index === 0,
    }))

    const next = reduceAppData(data, {
      type: 'quote/toggle',
      quoteId: data.quotes[0].id,
    })

    expect(next.quotes[0].enabled).toBe(true)
  })

  it('does not remove the last enabled quote', () => {
    const data = defaultAppData('2026-07-13')
    data.quotes = [
      {
        id: 'quote_only',
        text: '唯一短句',
        author: 'Flowish',
        enabled: true,
        source: 'custom',
      },
    ]

    const next = reduceAppData(data, {
      type: 'quote/remove',
      quoteId: 'quote_only',
    })

    expect(next.quotes).toEqual(data.quotes)
  })
})

describe('reduceAppData ritual ordering', () => {
  it('moves a ritual to the end when the target is null', () => {
    const data = defaultAppData('2026-07-13')
    const firstId = data.rituals[0].id

    const next = reduceAppData(data, {
      type: 'ritual/move',
      ritualId: firstId,
      targetId: null,
    })

    expect(next.rituals.at(-1)?.id).toBe(firstId)
  })
})

describe('useFlowishApp cross-tab synchronization', () => {
  it('applies external storage data without writing the same snapshot back', async () => {
    const todayKey = '2026-07-13'
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(defaultAppData(todayKey)))
    const { result } = renderHook(() => useFlowishApp(todayKey))
    await waitFor(() => expect(result.current.data.version).toBe(APP_DATA_VERSION))

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    setItemSpy.mockClear()
    const external = defaultAppData(todayKey)
    external.focusTasks = [createTask('来自另一个标签页', 'focus')]

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: APP_DATA_STORAGE_KEY,
          newValue: JSON.stringify(external),
        }),
      )
    })

    await waitFor(() => {
      expect(result.current.data.focusTasks[0]?.text).toBe('来自另一个标签页')
    })
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('persists a local action that is batched with an external storage update', async () => {
    const todayKey = '2026-07-13'
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(defaultAppData(todayKey)))
    const { result } = renderHook(() => useFlowishApp(todayKey))
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    setItemSpy.mockClear()
    const external = defaultAppData(todayKey)
    external.focusTasks = [createTask('外部事项', 'focus')]

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: APP_DATA_STORAGE_KEY,
          newValue: JSON.stringify(external),
        }),
      )
      result.current.commands.tasks.add('focus', '紧随其后的本地事项')
    })

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalled()
    })
    const latestWrite = setItemSpy.mock.calls
      .filter(([key]) => key === APP_DATA_STORAGE_KEY)
      .at(-1)?.[1]
    expect(JSON.parse(String(latestWrite)).focusTasks[0].text).toBe('紧随其后的本地事项')
  })

  it('rejects an incomplete current-version snapshot from another tab', () => {
    const todayKey = '2026-07-13'
    const initial = defaultAppData(todayKey)
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(initial))
    const { result } = renderHook(() => useFlowishApp(todayKey))

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: APP_DATA_STORAGE_KEY,
          newValue: `{"version":${APP_DATA_VERSION}}`,
        }),
      )
    })

    expect(result.current.data.focusTasks[0]?.id).toBe(initial.focusTasks[0]?.id)
    expect(result.current.lastError).toBe('另一标签页的数据无法同步，当前内容未更改。')
  })

  it('ignores storage events from a different storage area', () => {
    const todayKey = '2026-07-13'
    const initial = defaultAppData(todayKey)
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(initial))
    const { result } = renderHook(() => useFlowishApp(todayKey))
    const external = defaultAppData(todayKey)
    external.focusTasks = [createTask('不应同步', 'focus')]

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: APP_DATA_STORAGE_KEY,
          newValue: JSON.stringify(external),
          storageArea: sessionStorage,
        }),
      )
    })

    expect(result.current.data.focusTasks[0]?.id).toBe(initial.focusTasks[0]?.id)
  })

  it('surfaces a storage read failure without attempting to overwrite local data', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() => useFlowishApp('2026-07-13'))

    expect(result.current.lastError).toBe(
      '无法读取浏览器本地数据，当前修改暂时不会保存。',
    )
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})

describe('useFlowishApp task scheduling', () => {
  it('updates a focus time period and backlog due date through task commands', () => {
    const todayKey = '2026-07-14'
    const data = defaultAppData(todayKey)
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data))
    const { result } = renderHook(() => useFlowishApp(todayKey))
    const focusId = result.current.data.focusTasks[0].id
    const backlogId = result.current.data.backlogTasks[0].id

    act(() => {
      result.current.commands.tasks.updateSchedule('focus', focusId, { timeSlot: 'evening' })
      result.current.commands.tasks.updateSchedule('backlog', backlogId, { dueDate: '2026-07-20' })
    })

    expect(result.current.data.focusTasks[0].timeSlot).toBe('evening')
    expect(result.current.data.backlogTasks[0].dueDate).toBe('2026-07-20')
  })
})

describe('useFlowishApp event editing', () => {
  it('updates an existing important date without replacing its identity', () => {
    const todayKey = '2026-07-14'
    const data = defaultAppData(todayKey)
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data))
    const { result } = renderHook(() => useFlowishApp(todayKey))
    const eventId = result.current.data.events[0].id
    const createdAt = result.current.data.events[0].createdAt

    act(() => {
      result.current.commands.events.update(eventId, '新的节点', '2026-08-08', 'annual')
    })

    expect(result.current.data.events[0]).toMatchObject({
      id: eventId,
      title: '新的节点',
      date: '2026-08-08',
      type: 'annual',
      createdAt,
    })
  })
})

describe('useFlowishApp quote commands', () => {
  it('does not offer an undo action when the last enabled quote cannot be removed', () => {
    const data = defaultAppData('2026-07-13')
    data.quotes = [
      {
        id: 'quote_only',
        text: '唯一短句',
        author: 'Flowish',
        enabled: true,
        source: 'custom',
      },
    ]
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data))
    const { result } = renderHook(() => useFlowishApp('2026-07-13'))

    let operation: ReturnType<typeof result.current.commands.quotes.remove> = null
    act(() => {
      operation = result.current.commands.quotes.remove('quote_only')
    })

    expect(operation).toBeNull()
    expect(result.current.data.quotes).toHaveLength(1)
  })
})

describe('useFlowishApp theme metadata', () => {
  it('keeps the browser theme color aligned with the selected theme', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
    const data = defaultAppData('2026-07-13')
    data.preferences.theme = 'obsidian'
    localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(data))
    const { result } = renderHook(() => useFlowishApp('2026-07-13'))

    expect(meta.content).toBe('#181a17')
    act(() => result.current.commands.preferences.update({ theme: 'pearl' }))
    expect(meta.content).toBe('#f2efe5')
  })
})
