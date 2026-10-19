import type { AppData } from '../store/appData'
import { CloseIcon } from './Icon'
import { CalendarWidget } from './CalendarWidget'
import { DialogShell } from './DialogShell'

interface CalendarStageProps {
  appData: AppData
  todayKey: string
  selectedDate: string
  viewDate: Date
  onClose: () => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDate: (dateKey: string) => void
}

export function CalendarStage({
  appData,
  todayKey,
  selectedDate,
  viewDate,
  onClose,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}: CalendarStageProps) {
  return (
    <DialogShell ariaLabel="全屏月历" className="stage-dialog" onClose={onClose}>
      <section className="dialog-surface stage-sheet">
        <button className="icon-button stage-close" type="button" onClick={onClose} aria-label="关闭全屏月历">
          <CloseIcon width={18} height={18} />
        </button>
        <CalendarWidget
          appData={appData}
          todayKey={todayKey}
          selectedDate={selectedDate}
          viewDate={viewDate}
          variant="stage"
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onToday={onToday}
          onSelectDate={onSelectDate}
        />
      </section>
    </DialogShell>
  )
}
