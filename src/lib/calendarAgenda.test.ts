import { describe, expect, it } from 'vitest'

import { createTask, defaultAppData } from '../store/appData'
import { getCalendarAgendaForDate } from './calendarAgenda'

describe('getCalendarAgendaForDate', () => {
  it('projects focus periods, backlog deadlines and date plans into one derived agenda', () => {
    const data = defaultAppData('2026-07-14')
    data.focusTasks = [
      createTask('上午重点', 'focus', null, { timeSlot: 'morning' }),
      createTask('夜间重点', 'focus', null, { timeSlot: 'lateNight' }),
    ]
    data.backlogTasks = [
      createTask('截止事项', 'backlog', null, { dueDate: '2026-07-14' }),
    ]
    data.datePlans['2026-07-14'] = {
      date: '2026-07-14',
      note: '',
      tasks: [createTask('日期任务', 'date')],
    }

    const agenda = getCalendarAgendaForDate(data, '2026-07-14', '2026-07-14')

    expect(agenda.map((item) => [item.source, item.text])).toEqual([
      ['focus', '上午重点'],
      ['focus', '夜间重点'],
      ['backlog', '截止事项'],
      ['datePlan', '日期任务'],
      ['event', '月度复盘'],
    ])
  })

  it('keeps focus tasks on today and annual events on their recurring date', () => {
    const data = defaultAppData('2026-07-14')
    data.focusTasks = [createTask('只属于今天', 'focus')]
    data.events = [
      {
        id: 'annual',
        title: '纪念日',
        date: '2020-07-20',
        type: 'annual',
        createdAt: '2020-07-20T00:00:00.000Z',
      },
    ]

    expect(getCalendarAgendaForDate(data, '2026-07-20', '2026-07-14')).toEqual([
      expect.objectContaining({ source: 'event', id: 'annual', text: '纪念日' }),
    ])
    expect(
      getCalendarAgendaForDate(data, '2026-07-15', '2026-07-14').some(
        (item) => item.source === 'focus',
      ),
    ).toBe(false)
  })
})
