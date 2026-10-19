import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Task } from '../store/appData'
import { TaskList } from './TaskList'

const makeTask = (id: string, text: string): Task => ({
  id,
  text,
  completed: false,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T08:00:00.000Z',
  bucket: 'focus',
  priority: null,
  timeSlot: null,
  dueDate: null,
})

function renderTaskList(
  tasks: Task[],
  onDropTask = vi.fn(),
  bucket: 'focus' | 'backlog' = 'focus',
) {
  const props = {
    title: bucket === 'focus' ? '今日重点' : '积压事项',
    bucket,
    tasks,
    accent: bucket,
    emptyState: '添加一件事。',
    inputPlaceholder: '新增任务',
    onAdd: vi.fn(),
    onToggle: vi.fn(),
    onDelete: vi.fn(),
    onUpdate: vi.fn(),
    onUpdateSchedule: vi.fn(),
    onDropTask,
  }

  return { ...render(<TaskList {...props} />), props }
}

describe('TaskList', () => {
  it('handles a row drop once instead of bubbling a second move to the list', () => {
    const onDropTask = vi.fn()
    const { container } = renderTaskList(
      [makeTask('task-a', '任务甲'), makeTask('task-b', '任务乙')],
      onDropTask,
    )
    const target = container.querySelectorAll<HTMLElement>('.task-card')[1]

    fireEvent.drop(target, {
      dataTransfer: {
        getData: () => JSON.stringify({ bucket: 'focus', taskId: 'task-a' }),
      },
    })

    expect(onDropTask).toHaveBeenCalledOnce()
    expect(onDropTask).toHaveBeenCalledWith('focus', 'task-a', 'task-b')
  })

  it('starts editing from the latest task text after data replacement', () => {
    const initial = makeTask('task-a', '旧内容')
    const { rerender, props } = renderTaskList([initial])
    const updated = { ...initial, text: '导入后的内容', updatedAt: '2026-07-13T09:00:00.000Z' }

    rerender(<TaskList {...props} tasks={[updated]} />)
    fireEvent.click(screen.getByRole('button', { name: '编辑“导入后的内容”' }))

    expect(screen.getByRole('textbox', { name: '编辑任务内容' })).toHaveValue('导入后的内容')
  })

  it('starts inline editing when the task title is double-clicked', () => {
    renderTaskList([makeTask('task-a', '双击编辑')])

    fireEvent.doubleClick(screen.getByText('双击编辑'))

    expect(screen.getByRole('textbox', { name: '编辑任务内容' })).toHaveValue('双击编辑')
  })

  it('updates a focus period without opening the edit action', () => {
    const { props } = renderTaskList([makeTask('task-a', '安排到晚上')])

    fireEvent.change(screen.getByRole('combobox', { name: '“安排到晚上”的时间段' }), {
      target: { value: 'evening' },
    })

    expect(props.onUpdateSchedule).toHaveBeenCalledWith('task-a', { timeSlot: 'evening' })
  })

  it('submits a focus task with the selected period', () => {
    const { props } = renderTaskList([])
    fireEvent.change(screen.getByRole('textbox', { name: '新增任务' }), {
      target: { value: '下午完成方案' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '新任务时间段' }), {
      target: { value: 'afternoon' },
    })

    fireEvent.submit(screen.getByRole('textbox', { name: '新增任务' }).closest('form')!)

    expect(props.onAdd).toHaveBeenCalledWith('下午完成方案', { timeSlot: 'afternoon' })
  })

  it('updates and submits backlog deadlines directly', () => {
    const task = { ...makeTask('task-a', '整理资料'), bucket: 'backlog' as const }
    const { props } = renderTaskList([task], vi.fn(), 'backlog')

    fireEvent.change(screen.getByLabelText('“整理资料”的截止日期'), {
      target: { value: '2026-07-20' },
    })
    expect(props.onUpdateSchedule).toHaveBeenCalledWith('task-a', { dueDate: '2026-07-20' })

    fireEvent.change(screen.getByRole('textbox', { name: '新增任务' }), {
      target: { value: '提交材料' },
    })
    fireEvent.change(screen.getByLabelText('新任务截止日期'), {
      target: { value: '2026-07-22' },
    })
    fireEvent.submit(screen.getByRole('textbox', { name: '新增任务' }).closest('form')!)

    expect(props.onAdd).toHaveBeenCalledWith('提交材料', { dueDate: '2026-07-22' })
  })

  it('offers click and arrow-key ordering without requiring drag and drop', () => {
    const onDropTask = vi.fn()
    renderTaskList(
      [makeTask('task-a', '任务甲'), makeTask('task-b', '任务乙')],
      onDropTask,
    )

    fireEvent.click(screen.getByRole('button', { name: /调整“任务甲”顺序/ }))
    fireEvent.click(screen.getByRole('button', { name: '下移“任务甲”' }))
    expect(onDropTask).toHaveBeenLastCalledWith('focus', 'task-a', null)

    fireEvent.keyDown(screen.getByRole('button', { name: /调整“任务乙”顺序/ }), {
      key: 'ArrowUp',
    })
    expect(onDropTask).toHaveBeenLastCalledWith('focus', 'task-b', 'task-a')
  })

  it('clears an obsolete ordering announcement after data replacement', () => {
    const { rerender, props } = renderTaskList([
      makeTask('task-a', '任务甲'),
      makeTask('task-b', '任务乙'),
    ])
    fireEvent.click(screen.getByRole('button', { name: /调整“任务甲”顺序/ }))
    fireEvent.click(screen.getByRole('button', { name: '下移“任务甲”' }))
    expect(screen.getByText('已将“任务甲”下移到第 2 项')).toBeInTheDocument()

    rerender(<TaskList {...props} tasks={[makeTask('imported', '导入任务')]} />)

    expect(screen.queryByText('已将“任务甲”下移到第 2 项')).not.toBeInTheDocument()
  })
})
