import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PomodoroConfig } from '../store/appData'
import { PomodoroTimer } from './PomodoroTimer'

const config: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsPerCycle: 4,
}

describe('PomodoroTimer', () => {
  it('opens a secondary timer dialog and returns focus when it closes', async () => {
    render(
      <PomodoroTimer
        config={config}
        soundEnabled={false}
        onConfigChange={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: '打开番茄钟' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: '番茄钟' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '专注' })).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: '关闭番茄钟' }))
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('uses the deadline when a throttled tab becomes active again', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'))

    try {
      const { unmount } = render(
        <PomodoroTimer
          config={{ ...config, focusMinutes: 1 }}
          soundEnabled={false}
          onConfigChange={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '开始专注' }))

      vi.setSystemTime(new Date('2026-07-14T10:00:45.000Z'))
      fireEvent(window, new Event('focus'))

      expect(screen.getByRole('timer', { name: '专注剩余 00:15' })).toBeInTheDocument()
      unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('freezes while paused and resumes from the frozen remainder', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'))

    try {
      render(
        <PomodoroTimer
          config={{ ...config, focusMinutes: 1 }}
          soundEnabled={false}
          onConfigChange={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
      vi.setSystemTime(new Date('2026-07-14T10:00:20.000Z'))
      fireEvent(window, new Event('focus'))
      fireEvent.click(screen.getByRole('button', { name: '暂停番茄钟' }))

      vi.setSystemTime(new Date('2026-07-14T10:02:20.000Z'))
      fireEvent(window, new Event('focus'))
      expect(screen.getByRole('timer', { name: '专注剩余 00:40' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '继续专注' }))
      vi.setSystemTime(new Date('2026-07-14T10:02:35.000Z'))
      fireEvent(document, new Event('visibilitychange'))
      expect(screen.getByRole('timer', { name: '专注剩余 00:25' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops at zero and offers the next break without starting it automatically', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'))

    try {
      render(
        <PomodoroTimer
          config={{ ...config, focusMinutes: 1 }}
          soundEnabled={false}
          onConfigChange={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
      vi.setSystemTime(new Date('2026-07-14T10:01:00.000Z'))
      fireEvent(window, new Event('focus'))

      expect(screen.getByRole('timer', { name: '专注剩余 00:00' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '开始短休' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '暂停番茄钟' })).not.toBeInTheDocument()
      expect(screen.getByText('专注结束，建议短休')).toHaveAttribute('aria-live', 'polite')

      fireEvent.click(screen.getByRole('button', { name: '打开番茄钟' }))
      const dialog = screen.getByRole('dialog', { name: '番茄钟' })
      expect(within(dialog).getByText('建议短休')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: '开始短休' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: '稍后' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves custom durations while keeping the active session frozen', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'))
    const onConfigChange = vi.fn()

    try {
      render(
        <PomodoroTimer
          config={{ ...config, focusMinutes: 1 }}
          soundEnabled={false}
          onConfigChange={onConfigChange}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
      vi.setSystemTime(new Date('2026-07-14T10:00:20.000Z'))
      fireEvent(window, new Event('focus'))
      fireEvent.click(screen.getByRole('button', { name: '打开番茄钟' }))

      fireEvent.change(screen.getByRole('spinbutton', { name: '专注时长' }), {
        target: { value: '5' },
      })
      fireEvent.change(screen.getByRole('spinbutton', { name: '短休时长' }), {
        target: { value: '6' },
      })
      fireEvent.change(screen.getByRole('spinbutton', { name: '长休时长' }), {
        target: { value: '20' },
      })
      fireEvent.change(screen.getByRole('spinbutton', { name: '长休轮次' }), {
        target: { value: '3' },
      })
      fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

      expect(onConfigChange).toHaveBeenCalledWith({
        focusMinutes: 5,
        shortBreakMinutes: 6,
        longBreakMinutes: 20,
        roundsPerCycle: 3,
      })
      const compact = screen.getByRole('button', { name: '打开番茄钟' })
      expect(within(compact).getByRole('timer', { name: '专注剩余 00:40' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '重置番茄钟' }))
      expect(within(compact).getByRole('timer', { name: '专注剩余 05:00' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the configured focus-round progress in the dialog', () => {
    render(
      <PomodoroTimer
        config={config}
        soundEnabled={false}
        onConfigChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '打开番茄钟' }))

    const rounds = screen.getByRole('group', { name: '专注轮次' })
    expect(within(rounds).getByText('0/4')).toBeInTheDocument()
    expect(within(rounds).getByRole('button', { name: '清空轮次' })).toBeInTheDocument()
  })

  it('releases bounded completion feedback resources when it unmounts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'))
    const originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext')
    const close = vi.fn(async () => undefined)

    class MockAudioContext {
      currentTime = 0
      destination = {}
      state = 'running'
      close = close
      createOscillator = () => ({
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        addEventListener: vi.fn(),
      })
      createGain = () => ({
        gain: {
          value: 0,
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      })
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })

    try {
      const { unmount } = render(
        <PomodoroTimer
          config={{ ...config, focusMinutes: 1 }}
          soundEnabled
          onConfigChange={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
      vi.setSystemTime(new Date('2026-07-14T10:01:00.000Z'))
      fireEvent(window, new Event('focus'))

      expect(screen.getByRole('button', { name: '打开番茄钟' }).parentElement).toHaveClass('done-flash')
      unmount()
      expect(close).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      if (originalAudioContext) {
        Object.defineProperty(window, 'AudioContext', originalAudioContext)
      } else {
        Reflect.deleteProperty(window, 'AudioContext')
      }
      vi.useRealTimers()
    }
  })

  it('clears completion feedback when the current session is reset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'))

    try {
      render(
        <PomodoroTimer
          config={{ ...config, focusMinutes: 1 }}
          soundEnabled={false}
          onConfigChange={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
      vi.setSystemTime(new Date('2026-07-14T10:01:00.000Z'))
      fireEvent(window, new Event('focus'))

      const widget = screen.getByRole('button', { name: '打开番茄钟' }).parentElement
      expect(widget).toHaveClass('done-flash')
      fireEvent.click(screen.getByRole('button', { name: '重置番茄钟' }))

      expect(widget).not.toHaveClass('done-flash')
      expect(screen.queryByText('专注结束，建议短休')).not.toBeInTheDocument()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
