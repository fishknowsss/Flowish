import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EventItem } from '../store/appData'
import { CountdownPanel } from './CountdownPanel'

const event: EventItem = {
  id: 'event-a',
  title: '项目复盘',
  date: '2026-07-20',
  type: 'countdown',
  createdAt: '2026-07-14T08:00:00.000Z',
}

function renderPanel(onUpdate = vi.fn()) {
  return render(
    <CountdownPanel
      events={[event]}
      todayKey="2026-07-14"
      onAdd={vi.fn()}
      onUpdate={onUpdate}
      onDelete={vi.fn()}
    />,
  )
}

describe('CountdownPanel', () => {
  it('opens direct editing when an event title is double-clicked', () => {
    renderPanel()

    fireEvent.doubleClick(screen.getByText('项目复盘'))

    expect(screen.getByRole('textbox', { name: '编辑日期名称' })).toHaveValue('项目复盘')
  })

  it('updates the event from the inline editor', () => {
    const onUpdate = vi.fn()
    renderPanel(onUpdate)
    fireEvent.doubleClick(screen.getByText('项目复盘'))

    fireEvent.change(screen.getByRole('textbox', { name: '编辑日期名称' }), {
      target: { value: '交付节点' },
    })
    fireEvent.change(screen.getByLabelText('编辑日期'), {
      target: { value: '2026-07-22' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '编辑类型' }), {
      target: { value: 'annual' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onUpdate).toHaveBeenCalledWith('event-a', '交付节点', '2026-07-22', 'annual')
  })

  it('keeps an explicit edit button for keyboard and touch users', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: '编辑“项目复盘”' }))

    expect(screen.getByRole('textbox', { name: '编辑日期名称' })).toHaveFocus()
  })
})
