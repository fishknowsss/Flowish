import type { AppData, FocusTimeSlot } from '../store/appData'

export type CalendarAgendaSource = 'focus' | 'backlog' | 'datePlan' | 'event' | 'ritual'

export interface CalendarAgendaItem {
  key: string
  source: CalendarAgendaSource
  id: string
  text: string
  completed: boolean
  timeSlot: FocusTimeSlot | null
}

const timeSlotOrder: Record<FocusTimeSlot, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  lateNight: 3,
}

function eventOccursOnDate(date: string, type: AppData['events'][number]['type'], dateKey: string) {
  return date === dateKey || (type === 'annual' && date.slice(5) === dateKey.slice(5))
}

export function getCalendarAgendaForDate(
  appData: AppData,
  dateKey: string,
  todayKey = appData.preferences.lastActiveDate,
): CalendarAgendaItem[] {
  const focusItems = dateKey === todayKey
    ? [...appData.focusTasks]
        .sort(
          (left, right) =>
            (left.timeSlot ? timeSlotOrder[left.timeSlot] : 4) -
            (right.timeSlot ? timeSlotOrder[right.timeSlot] : 4),
        )
        .map((task) => ({
          key: `focus:${task.id}:${dateKey}`,
          source: 'focus' as const,
          id: task.id,
          text: task.text,
          completed: task.completed,
          timeSlot: task.timeSlot,
        }))
    : []

  const backlogItems = appData.backlogTasks
    .filter((task) => task.dueDate === dateKey)
    .map((task) => ({
      key: `backlog:${task.id}:${dateKey}`,
      source: 'backlog' as const,
      id: task.id,
      text: task.text,
      completed: task.completed,
      timeSlot: null,
    }))

  const datePlanItems = (appData.datePlans[dateKey]?.tasks ?? []).map((task) => ({
    key: `datePlan:${task.id}:${dateKey}`,
    source: 'datePlan' as const,
    id: task.id,
    text: task.text,
    completed: task.completed,
    timeSlot: null,
  }))

  const eventItems = appData.events
    .filter((event) => eventOccursOnDate(event.date, event.type, dateKey))
    .map((event) => ({
      key: `event:${event.id}:${dateKey}`,
      source: 'event' as const,
      id: event.id,
      text: event.title,
      completed: false,
      timeSlot: null,
    }))

  const ritualItems = appData.rituals
    .filter((ritual) => ritual.completionHistory[dateKey])
    .map((ritual) => ({
      key: `ritual:${ritual.id}:${dateKey}`,
      source: 'ritual' as const,
      id: ritual.id,
      text: ritual.text,
      completed: true,
      timeSlot: null,
    }))

  return [...focusItems, ...backlogItems, ...datePlanItems, ...eventItems, ...ritualItems]
}
