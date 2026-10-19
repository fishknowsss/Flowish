import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { defaultAppData } from '../store/appData'
import { SearchOverlay } from './SearchOverlay'

describe('SearchOverlay', () => {
  it('finds date plans by date as well as task text', () => {
    const appData = defaultAppData('2026-07-13')
    appData.datePlans['2026-07-15'] = {
      date: '2026-07-15',
      note: '准备发布',
      tasks: [
        {
          id: 'date-task',
          text: '检查发布清单',
          completed: false,
          createdAt: '2026-07-13T08:00:00.000Z',
          updatedAt: '2026-07-13T08:00:00.000Z',
        bucket: 'date',
        priority: null,
        timeSlot: null,
        dueDate: null,
        },
      ],
    }

    const onSelect = vi.fn()
    render(<SearchOverlay appData={appData} onClose={vi.fn()} onSelect={onSelect} />)
    fireEvent.change(screen.getByRole('textbox', { name: '全局搜索' }), {
      target: { value: '2026-07-15' },
    })
    fireEvent.click(screen.getByRole('button', { name: /检查发布清单/ }))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'date-task', dateKey: '2026-07-15', type: 'date' }),
    )
  })
})
