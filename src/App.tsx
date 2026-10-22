import { useEffect, useMemo, useRef, useState } from 'react'

import { BacklogPanel } from './components/BacklogPanel'
import { CalendarStage } from './components/CalendarStage'
import { CalendarWidget } from './components/CalendarWidget'
import { CountdownPanel } from './components/CountdownPanel'
import { DatePlannerDrawer } from './components/DatePlannerDrawer'
import { FocusPanel } from './components/FocusPanel'
import { QuoteManager } from './components/QuoteManager'
import { RitualsPanel } from './components/RitualsPanel'
import { SearchOverlay, type SearchResult } from './components/SearchOverlay'
import { TodaySummary } from './components/TodaySummary'
import { TopBar } from './components/TopBar'
import {
  addMonths,
  getDailySeed,
  getEventRelevantDateKey,
  parseDateKey,
  startOfMonth,
} from './lib/date'
import { getEnabledQuotes } from './lib/quotes'
import { backupAppDataBeforeImport, exportAppData, importAppData } from './lib/storage'
import { useTodayKey } from './lib/useTodayKey'
import type { DatePlan, ThemeMode } from './store/appData'
import { type UndoOperation, useFlowishApp } from './store/useFlowishApp'

const THEME_CYCLE: ThemeMode[] = ['pearl', 'obsidian']

interface Notice {
  message: string
  action?: () => void
}

function playFeedbackSound(type: 'add' | 'complete' | 'delete' | 'surface', enabled: boolean) {
  if (!enabled) return

  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const config = {
      add: { frequency: 660, duration: 0.08 },
      complete: { frequency: 540, duration: 0.12 },
      delete: { frequency: 280, duration: 0.09 },
      surface: { frequency: 460, duration: 0.05 },
    }[type]

    oscillator.frequency.value = config.frequency
    gain.gain.value = 0.0001
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + config.duration)
    oscillator.stop(context.currentTime + config.duration)
    oscillator.addEventListener('ended', () => void context.close(), { once: true })
  } catch {
    // Sound feedback is optional; unsupported audio must never block the action.
  }
}

function App() {
  const todayKey = useTodayKey()
  const { data: appData, commands, lastError, clearError, reportError } = useFlowishApp(todayKey)
  const [selectedDateOverride, setSelectedDateOverride] = useState<string | null>(null)
  const [calendarMonthOverride, setCalendarMonthOverride] = useState<Date | null>(null)
  const [calendarStageOpen, setCalendarStageOpen] = useState(
    appData.preferences.calendarExpandedDefault,
  )
  const [datePlannerOpen, setDatePlannerOpen] = useState(false)
  const [quoteManagerOpen, setQuoteManagerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [quoteOffset, setQuoteOffset] = useState(0)
  const [randomQuoteSeed, setRandomQuoteSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dataGeneration, setDataGeneration] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const showNotice = (nextNotice: Notice) => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    setNotice(nextNotice)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 6_000)
  }

  const dismissNotice = () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = null
    setNotice(null)
  }

  const offerUndo = (operation: UndoOperation | null) => {
    if (!operation) return
    showNotice({ message: operation.message, action: operation.restore })
  }

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
  }, [])

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setInstallPrompt(promptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (document.querySelector('dialog[open]')) return
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const enabledQuotes = useMemo(() => getEnabledQuotes(appData.quotes), [appData.quotes])
  const selectedDate = selectedDateOverride ?? todayKey
  const calendarMonth = calendarMonthOverride ?? startOfMonth(parseDateKey(todayKey))
  const quoteBase =
    appData.preferences.quoteMode === 'daily'
      ? getDailySeed(todayKey, enabledQuotes.length)
      : randomQuoteSeed % enabledQuotes.length
  const activeQuote = enabledQuotes[(quoteBase + quoteOffset) % enabledQuotes.length]
  const selectedPlan =
    appData.datePlans[selectedDate] ??
    ({ date: selectedDate, tasks: [], note: '' } satisfies DatePlan)

  const selectDate = (dateKey: string) => {
    const followsToday = dateKey === todayKey
    setSelectedDateOverride(followsToday ? null : dateKey)
    setCalendarMonthOverride(followsToday ? null : startOfMonth(parseDateKey(dateKey)))
  }

  const revealSearchResult = (result: SearchResult) => {
    setSearchOpen(false)

    if (result.type === 'date' && result.dateKey) {
      selectDate(result.dateKey)
      setDatePlannerOpen(true)
      return
    }

    if (result.type === 'event') {
      const event = appData.events.find((candidate) => candidate.id === result.id)
      if (event) selectDate(getEventRelevantDateKey(event, todayKey))
    }

    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-search-id="${CSS.escape(result.id)}"]`)
      target?.scrollIntoView({
        behavior: appData.preferences.reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      })
      target?.focus({ preventScroll: true })
    })
  }

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(appData.preferences.theme)
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length]
    commands.preferences.update({ theme: nextTheme })
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主内容</a>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          try {
            const importedData = await importAppData(file)
            backupAppDataBeforeImport(appData)
            commands.replace(importedData)
            setDataGeneration((generation) => generation + 1)
            showNotice({ message: '数据已导入' })
          } catch (error) {
            reportError(error instanceof Error ? error.message : '导入失败，请检查备份文件。')
          } finally {
            event.target.value = ''
          }
        }}
      />

      <TopBar
        todayKey={todayKey}
        quoteText={activeQuote.text}
        quoteAuthor={activeQuote.author}
        preferences={appData.preferences}
        installAvailable={Boolean(installPrompt)}
        onNextQuote={() => setQuoteOffset((offset) => offset + 1)}
        onManageQuotes={() => setQuoteManagerOpen(true)}
        onToggleSound={() => {
          const soundEnabled = !appData.preferences.soundEnabled
          commands.preferences.update({ soundEnabled })
          playFeedbackSound('surface', soundEnabled)
        }}
        onToggleTheme={cycleTheme}
        onToggleMotion={() =>
          commands.preferences.update({ reducedMotion: !appData.preferences.reducedMotion })
        }
        onToggleQuoteMode={() => {
          const quoteMode = appData.preferences.quoteMode === 'daily' ? 'random' : 'daily'
          if (quoteMode === 'random') {
            setRandomQuoteSeed(Math.floor(Math.random() * 1_000_000))
            setQuoteOffset(0)
          }
          commands.preferences.update({ quoteMode })
        }}
        onToggleCalendarDefault={() =>
          commands.preferences.update({
            calendarExpandedDefault: !appData.preferences.calendarExpandedDefault,
          })
        }
        onPomodoroConfigChange={(pomodoro) => commands.preferences.update({ pomodoro })}
        onExport={() => {
          try {
            exportAppData(appData)
            showNotice({ message: '备份已导出' })
          } catch {
            reportError('导出失败，请稍后再试。')
          }
        }}
        onImport={() => fileInputRef.current?.click()}
        onInstall={async () => {
          if (!installPrompt) return
          try {
            await installPrompt.prompt()
          } catch {
            reportError('暂时无法安装，请使用浏览器菜单重试。')
          } finally {
            setInstallPrompt(null)
          }
        }}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main key={dataGeneration} id="main-content" className="workspace-board" tabIndex={-1}>
        <section className="focus-rail" aria-label="重点与节律">
          <FocusPanel
            tasks={appData.focusTasks}
            onAdd={(text, schedule) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              commands.tasks.add('focus', text, null, schedule)
            }}
            onToggle={(taskId) => {
              playFeedbackSound('complete', appData.preferences.soundEnabled)
              commands.tasks.toggle('focus', taskId)
            }}
            onDelete={(taskId) => {
              playFeedbackSound('delete', appData.preferences.soundEnabled)
              offerUndo(commands.tasks.remove('focus', taskId))
            }}
            onUpdate={(taskId, text) => commands.tasks.update('focus', taskId, text)}
            onUpdateSchedule={(taskId, patch) => commands.tasks.updateSchedule('focus', taskId, patch)}
            onDropTask={(sourceBucket, taskId, targetId) =>
              commands.tasks.move('focus', sourceBucket, taskId, targetId)
            }
          />
          <RitualsPanel
            rituals={appData.rituals}
            todayKey={todayKey}
            onAdd={(text) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              commands.rituals.add(text)
            }}
            onToggle={(ritualId, dateKey) => {
              playFeedbackSound('complete', appData.preferences.soundEnabled)
              commands.rituals.toggle(ritualId, dateKey)
            }}
            onDelete={(ritualId) => {
              playFeedbackSound('delete', appData.preferences.soundEnabled)
              offerUndo(commands.rituals.remove(ritualId))
            }}
            onUpdate={commands.rituals.update}
            onDropRitual={commands.rituals.move}
          />
        </section>

        <section className="time-board" aria-label="时间板">
          <CalendarWidget
            appData={appData}
            todayKey={todayKey}
            selectedDate={selectedDate}
            viewDate={calendarMonth}
            onPrevMonth={() => setCalendarMonthOverride(addMonths(calendarMonth, -1))}
            onNextMonth={() => setCalendarMonthOverride(addMonths(calendarMonth, 1))}
            onToday={() => selectDate(todayKey)}
            onSelectDate={selectDate}
            onOpenPlanner={() => setDatePlannerOpen(true)}
            onOpenStage={() => {
              playFeedbackSound('surface', appData.preferences.soundEnabled)
              setCalendarStageOpen(true)
            }}
          />

          <CountdownPanel
            events={appData.events}
            todayKey={todayKey}
            onAdd={(title, date, type) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              commands.events.add(title, date, type)
            }}
            onUpdate={commands.events.update}
            onDelete={(eventId) => {
              playFeedbackSound('delete', appData.preferences.soundEnabled)
              offerUndo(commands.events.remove(eventId))
            }}
          />
        </section>

        <aside className="backlog-rail" aria-label="总览与积压">
          <TodaySummary
            focusTasks={appData.focusTasks}
            backlogTasks={appData.backlogTasks}
            rituals={appData.rituals}
            todayKey={todayKey}
            selectedDate={selectedDate}
            selectedPlan={selectedPlan}
            events={appData.events}
          />

          <BacklogPanel
            tasks={appData.backlogTasks}
            onAdd={(text, schedule) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              commands.tasks.add('backlog', text, null, schedule)
            }}
            onToggle={(taskId) => {
              playFeedbackSound('complete', appData.preferences.soundEnabled)
              commands.tasks.toggle('backlog', taskId)
            }}
            onDelete={(taskId) => {
              playFeedbackSound('delete', appData.preferences.soundEnabled)
              offerUndo(commands.tasks.remove('backlog', taskId))
            }}
            onUpdate={(taskId, text) => commands.tasks.update('backlog', taskId, text)}
            onUpdateSchedule={(taskId, patch) => commands.tasks.updateSchedule('backlog', taskId, patch)}
            onDropTask={(sourceBucket, taskId, targetId) =>
              commands.tasks.move('backlog', sourceBucket, taskId, targetId)
            }
            onClearCompleted={() => offerUndo(commands.tasks.clearCompleted('backlog'))}
          />
        </aside>
      </main>

      {calendarStageOpen ? (
        <CalendarStage
          appData={appData}
          todayKey={todayKey}
          selectedDate={selectedDate}
          viewDate={calendarMonth}
          onClose={() => setCalendarStageOpen(false)}
          onPrevMonth={() => setCalendarMonthOverride(addMonths(calendarMonth, -1))}
          onNextMonth={() => setCalendarMonthOverride(addMonths(calendarMonth, 1))}
          onToday={() => selectDate(todayKey)}
          onSelectDate={selectDate}
        />
      ) : null}

      {datePlannerOpen ? (
        <DatePlannerDrawer
          dateKey={selectedDate}
          plan={selectedPlan}
          appData={appData}
          onClose={() => setDatePlannerOpen(false)}
          onAddTask={(text) => commands.datePlans.addTask(selectedDate, text)}
          onToggleTask={(taskId) => commands.datePlans.toggleTask(selectedDate, taskId)}
          onDeleteTask={(taskId) => commands.datePlans.removeTask(selectedDate, taskId)}
          onUpdateTask={(taskId, text) => commands.datePlans.updateTask(selectedDate, taskId, text)}
          onNoteChange={(note) => commands.datePlans.updateNote(selectedDate, note)}
        />
      ) : null}

      {quoteManagerOpen ? (
        <QuoteManager
          quotes={appData.quotes}
          onClose={() => setQuoteManagerOpen(false)}
          onAdd={commands.quotes.add}
          onToggle={commands.quotes.toggle}
          onDelete={(quoteId) => offerUndo(commands.quotes.remove(quoteId))}
        />
      ) : null}

      {searchOpen ? (
        <SearchOverlay appData={appData} onClose={() => setSearchOpen(false)} onSelect={revealSearchResult} />
      ) : null}

      <div className="toast-region">
        {notice ? (
          <div className="undo-toast" role="status">
            <span>{notice.message}</span>
            {notice.action ? (
              <button
                type="button"
                onClick={() => {
                  notice.action?.()
                  dismissNotice()
                }}
              >
                撤销
              </button>
            ) : (
              <button type="button" onClick={dismissNotice}>关闭</button>
            )}
          </div>
        ) : null}
        {lastError ? (
          <div className="error-toast" role="alert">
            <span>{lastError}</span>
            <button type="button" onClick={clearError}>关闭</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default App
