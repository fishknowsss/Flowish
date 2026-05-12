import type { Task, TaskBucket } from '../store/appData'
import { StackIcon } from './Icon'
import { TaskList } from './TaskList'

interface BacklogPanelProps {
  tasks: Task[]
  onAdd: (text: string) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onUpdate: (taskId: string, text: string) => void
  onDropTask: (fromBucket: Exclude<TaskBucket, 'date'>, taskId: string, targetId: string | null) => void
  onClearCompleted: () => void
}

export function BacklogPanel(props: BacklogPanelProps) {
  return (
    <TaskList
      title="积压事项"
      eyebrow="Open loops"
      titleIcon={<StackIcon width={16} height={16} />}
      bucket="backlog"
      tasks={props.tasks}
      accent="backlog"
      emptyState="记下暂时不用安排的事。"
      inputPlaceholder="记下一条待办、想法或提醒"
      allowClearCompleted
      onAdd={props.onAdd}
      onToggle={props.onToggle}
      onDelete={props.onDelete}
      onUpdate={props.onUpdate}
      onDropTask={props.onDropTask}
      onClearCompleted={props.onClearCompleted}
    />
  )
}
