import { formatShortDate, getEventDayCopy, getEventDays, getEventRelevantDateKey } from '../lib/date'
import type { DatePlan, EventItem, Ritual, Task } from '../store/appData'

interface TodaySummaryProps {
  todayKey: string
  selectedDate?: string
  focusTasks: Task[]
  backlogTasks: Task[]
  rituals: Ritual[]
  selectedPlan?: DatePlan
  events?: EventItem[]
}

function getUpcomingEvent(events: EventItem[], todayKey: string) {
  return [...events]
    .filter((event) => event.type === 'countup' || getEventDays(event, todayKey) >= 0)
    .sort((left, right) => getEventDays(left, todayKey) - getEventDays(right, todayKey))[0]
}

function getSelectedDateSummary(selectedDate: string, todayKey: string, plan: DatePlan, events: EventItem[]) {
  const label = selectedDate === todayKey ? '今天窗口' : formatShortDate(selectedDate)
  const note = plan.note.trim()

  if (note) {
    return {
      label,
      headline: note.length > 80 ? `${note.slice(0, 80)}…` : note,
      meta: `${plan.tasks.length} 项安排 · ${events.length} 个事件`,
    }
  }

  return {
    label,
    headline: plan.tasks.length > 0 ? `已写下 ${plan.tasks.length} 项安排` : '还没有写下具体安排',
    meta: events.length > 0 ? `含 ${events.length} 个日期事件` : '可以补一条短记或一项任务',
  }
}

export function TodaySummary({
  todayKey,
  selectedDate = todayKey,
  focusTasks,
  backlogTasks,
  rituals,
  selectedPlan = { date: selectedDate, tasks: [], note: '' },
  events = [],
}: TodaySummaryProps) {
  const focusCompleted = focusTasks.filter((task) => task.completed).length
  const focusPending = focusTasks.length - focusCompleted
  const ritualCompleted = rituals.filter((ritual) => ritual.completionHistory[todayKey]).length
  const progressTotal = focusTasks.length + rituals.length
  const progressValue =
    progressTotal === 0 ? 0 : Math.round(((focusCompleted + ritualCompleted) / progressTotal) * 100)
  const backlogPending = backlogTasks.filter((task) => !task.completed).length
  const upcoming = getUpcomingEvent(events, todayKey)
  const selectedSummary = getSelectedDateSummary(selectedDate, todayKey, selectedPlan, events.filter((event) => getEventRelevantDateKey(event, todayKey) === selectedDate))

  return (
    <section className="overview-sheet solid-panel" aria-label="首页总览">
      <div className="overview-hero">
        <span className="overview-kicker">今日</span>
        <strong className="overview-number">{progressValue}%</strong>
        <p className="overview-title">完成进度</p>
        <progress className="progress-track" value={focusCompleted + ritualCompleted} max={Math.max(progressTotal, 1)} aria-label="今日完成进度" />
      </div>

      <div className="overview-lines">
        <article className="overview-line">
          <span>重点</span>
          <strong>{focusCompleted}/{focusTasks.length}</strong>
          <p>还剩 {focusPending} 项</p>
        </article>

        <article className="overview-line">
          <span>收纳</span>
          <strong>{backlogPending}</strong>
          <p>积压待推进</p>
        </article>

        <article className="overview-line">
          <span>节律</span>
          <strong>{ritualCompleted}/{rituals.length}</strong>
          <p>今日已完成</p>
        </article>

        <article className="overview-line">
          <span>{selectedSummary.label}</span>
          <strong>{selectedPlan.tasks.length}</strong>
          <p>{selectedSummary.headline}</p>
        </article>

        <article className="overview-line wide">
          <span>最近日期</span>
          {upcoming ? (
            <>
              <strong>{getEventDayCopy(upcoming, todayKey).phrase}</strong>
              <p>
                {upcoming.title} · {formatShortDate(getEventRelevantDateKey(upcoming, todayKey))}
              </p>
            </>
          ) : (
            <>
              <strong>空</strong>
              <p>还没有重要日期</p>
            </>
          )}
        </article>
      </div>
    </section>
  )
}
