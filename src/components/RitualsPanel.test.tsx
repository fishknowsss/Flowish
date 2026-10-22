import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Ritual } from '../store/appData'
import { RitualsPanel } from './RitualsPanel'

const makeRitual = (id: string, text: string): Ritual => ({
  id,
  text,
  active: true,
  completionHistory: {},
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T08:00:00.000Z',
})

describe('RitualsPanel', () => {
  it('shows today progress and the current week from Monday through Sunday', () => {
    const ritual = {
      ...makeRitual('ritual-a', '晨间规划'),
      completionHistory: {
        '2026-07-13': true as const,
        '2026-07-15': true as const,
      },
    }

    render(
      <RitualsPanel
        todayKey="2026-07-16"
        rituals={[ritual]}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onDropRitual={vi.fn()}
      />,
    )

    expect(screen.getByText('0/1', { selector: '.panel-side-meta strong' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '固定节律今日完成进度' })).toHaveAttribute('value', '0')

    const week = screen.getByRole('list', { name: '“晨间规划”本周完成 2 天' })
    const days = within(week).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days.every((day) => day.textContent === '')).toBe(true)
    expect(days.map((day) => day.getAttribute('aria-label'))).toEqual([
      '周一，7月13日，已完成',
      '周二，7月14日，未完成',
      '周三，7月15日，已完成',
      '周四，7月16日，未完成',
      '周五，7月17日，未完成',
      '周六，7月18日，未完成',
      '周日，7月19日，未完成',
    ])
  })

  it('starts text editing on double click without making the card draggable', () => {
    const onUpdate = vi.fn()
    render(
      <RitualsPanel
        todayKey="2026-07-16"
        rituals={[makeRitual('ritual-a', '晨间规划')]}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        onDropRitual={vi.fn()}
      />,
    )

    const label = screen.getByText('晨间规划', { selector: '.ritual-chip-label' })
    const card = label.closest('article')
    expect(screen.getByRole('button', { name: '编辑“晨间规划”' })).toBeInTheDocument()
    expect(card).toHaveAttribute('draggable', 'true')

    fireEvent.doubleClick(label)

    const editor = screen.getByRole('textbox', { name: '编辑循环任务内容' })
    expect(editor).toHaveValue('晨间规划')
    expect(card).toHaveAttribute('draggable', 'false')

    fireEvent.change(editor, { target: { value: '晨间规划与复盘' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(onUpdate).toHaveBeenCalledWith('ritual-a', '晨间规划与复盘')
  })

  it('clears an obsolete ordering announcement after data replacement', () => {
    const props = {
      todayKey: '2026-07-13',
      rituals: [makeRitual('ritual-a', '节律甲'), makeRitual('ritual-b', '节律乙')],
      onAdd: vi.fn(),
      onToggle: vi.fn(),
      onDelete: vi.fn(),
      onUpdate: vi.fn(),
      onDropRitual: vi.fn(),
    }
    const { rerender } = render(<RitualsPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /调整“节律甲”顺序/ }))
    fireEvent.click(screen.getByRole('button', { name: '下移“节律甲”' }))
    expect(screen.getByText('已将“节律甲”下移到第 2 项')).toBeInTheDocument()

    rerender(<RitualsPanel {...props} rituals={[]} />)

    expect(screen.queryByText('已将“节律甲”下移到第 2 项')).not.toBeInTheDocument()
  })
})
