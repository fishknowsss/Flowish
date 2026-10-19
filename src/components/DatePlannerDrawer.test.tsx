import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { createRitual, createTask, defaultAppData } from '../store/appData'
import { DatePlannerDrawer } from './DatePlannerDrawer'

const dateKey = '2026-07-14'

function renderPlanner() {
  const appData = defaultAppData(dateKey)
  appData.focusTasks = [
    createTask('上午完成方案', 'focus', null, { timeSlot: 'morning' }),
  ]
  appData.backlogTasks = [
    createTask('提交合同', 'backlog', null, { dueDate: dateKey }),
  ]
  const ritual = createRitual('晚间复盘')
  ritual.completionHistory[dateKey] = true
  appData.rituals = [ritual]
  appData.events = [
    {
      id: 'event-release',
      title: '发布日',
      date: dateKey,
      type: 'countdown',
      createdAt: '2026-07-01T08:00:00.000Z',
    },
  ]
  const plan = {
    date: dateKey,
    note: '',
    tasks: [createTask('检查发布清单', 'date')],
  }
  appData.datePlans[dateKey] = plan

  return render(
    <DatePlannerDrawer
      dateKey={dateKey}
      plan={plan}
      appData={appData}
      onClose={vi.fn()}
      onAddTask={vi.fn()}
      onToggleTask={vi.fn()}
      onDeleteTask={vi.fn()}
      onUpdateTask={vi.fn()}
      onNoteChange={vi.fn()}
    />,
  )
}

describe('DatePlannerDrawer', () => {
  it('shows derived workbench entries once in a read-only synced section', () => {
    renderPlanner()

    expect(screen.getByText('检查发布清单')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑“检查发布清单”' })).toBeInTheDocument()
    expect(screen.getByText('已同步')).toBeInTheDocument()
    expect(screen.getByText('4', { selector: '.subheading strong' })).toBeInTheDocument()
    expect(screen.getByText('上午完成方案')).toBeInTheDocument()
    expect(screen.getByText('上午重点')).toBeInTheDocument()
    expect(screen.getByText('提交合同')).toBeInTheDocument()
    expect(screen.getByText('截止')).toBeInTheDocument()
    expect(screen.getByText('晚间复盘')).toBeInTheDocument()
    expect(screen.getByText('固定节律 · 已完成')).toBeInTheDocument()
    expect(screen.getAllByText('发布日')).toHaveLength(1)
    expect(screen.getByText('重要日期')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑“上午完成方案”' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除“发布日”' })).not.toBeInTheDocument()
  })

  it('tells the next action when the selected date has no synced entries', () => {
    const appData = defaultAppData(dateKey)
    appData.focusTasks = []
    appData.backlogTasks = []
    appData.rituals = []
    appData.events = []
    appData.datePlans = {}
    const plan = { date: dateKey, note: '', tasks: [] }

    render(
      <DatePlannerDrawer
        dateKey={dateKey}
        plan={plan}
        appData={appData}
        onClose={vi.fn()}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onNoteChange={vi.fn()}
      />,
    )

    expect(screen.getByText('为这一天设置截止日期或重要日期。')).toBeInTheDocument()
  })
})
