import type { Task, TaskBucket, TaskSchedule } from '../store/appData'
import { FocusIcon } from './Icon'
import { TaskList } from './TaskList'

interface FocusPanelProps {
  tasks: Task[]
  onAdd: (text: string, schedule?: TaskSchedule) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onUpdate: (taskId: string, text: string) => void
  onUpdateSchedule: (taskId: string, patch: TaskSchedule) => void
  onDropTask: (fromBucket: Exclude<TaskBucket, 'date'>, taskId: string, targetId: string | null) => void
}

export function FocusPanel(props: FocusPanelProps) {
  return (
    <TaskList
      title="今日重点"
      titleIcon={<FocusIcon width={16} height={16} />}
      bucket="focus"
      tasks={props.tasks}
      accent="focus"
      emptyState="写下今天最重要的一件事。"
      inputPlaceholder="写下今天必须完成的一件事"
      onAdd={props.onAdd}
      onToggle={props.onToggle}
      onDelete={props.onDelete}
      onUpdate={props.onUpdate}
      onUpdateSchedule={props.onUpdateSchedule}
      onDropTask={props.onDropTask}
    />
  )
}
