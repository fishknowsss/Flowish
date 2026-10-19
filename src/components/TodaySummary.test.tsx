import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createRitual, createTask } from '../store/appData'
import { TodaySummary } from './TodaySummary'

describe('TodaySummary', () => {
  it('summarizes focus, ritual and backlog progress for today', () => {
    const completedFocus = { ...createTask('完成重点', 'focus'), completed: true }
    const pendingFocus = createTask('待办重点', 'focus')
    const completedRitual = {
      ...createRitual('晨间规划'),
      completionHistory: { '2026-07-13': true as const },
    }

    render(
      <TodaySummary
        focusTasks={[completedFocus, pendingFocus]}
        backlogTasks={[createTask('积压一', 'backlog'), createTask('积压二', 'backlog')]}
        rituals={[completedRitual, createRitual('睡前回顾')]}
        todayKey="2026-07-13"
      />,
    )

    expect(screen.getByText('50%', { selector: '.today-summary-head strong' })).toBeInTheDocument()
    expect(screen.getByText('1', { selector: '.today-summary-stats strong' })).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('2', { selector: '.today-summary-stats strong' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '今日完成进度' })).toHaveAttribute('value', '2')
  })
})
