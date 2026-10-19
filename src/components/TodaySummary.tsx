import type { Ritual, Task } from '../store/appData'

interface TodaySummaryProps {
  focusTasks: Task[]
  backlogTasks: Task[]
  rituals: Ritual[]
  todayKey: string
}

export function TodaySummary({
  focusTasks,
  backlogTasks,
  rituals,
  todayKey,
}: TodaySummaryProps) {
  const focusDone = focusTasks.filter((task) => task.completed).length
  const ritualDone = rituals.filter((ritual) => ritual.completionHistory[todayKey]).length
  const backlogPending = backlogTasks.filter((task) => !task.completed).length
  const dailyTotal = focusTasks.length + rituals.length
  const dailyDone = focusDone + ritualDone
  const progress = dailyTotal === 0 ? 0 : Math.round((dailyDone / dailyTotal) * 100)

  return (
    <section className="panel today-summary" aria-label="今日概览">
      <div className="today-summary-head">
        <div>
          <span>今日进度</span>
          <strong>{progress}%</strong>
        </div>
        <p>{dailyDone}/{dailyTotal}</p>
      </div>

      <progress
        className="today-progress"
        value={dailyDone}
        max={Math.max(dailyTotal, 1)}
        aria-label="今日完成进度"
      >
        {progress}%
      </progress>

      <div className="today-summary-stats">
        <div>
          <strong>{focusTasks.length - focusDone}</strong>
          <span>重点待办</span>
        </div>
        <div className="ritual-stat">
          <strong>{ritualDone}/{rituals.length}</strong>
          <span>节律完成</span>
        </div>
        <div>
          <strong>{backlogPending}</strong>
          <span>积压事项</span>
        </div>
      </div>
    </section>
  )
}
