import { useEffect, useMemo, useRef, useState } from 'react'

import { BacklogPanel } from './components/BacklogPanel'
import { CalendarStage } from './components/CalendarStage'
import { CalendarWidget } from './components/CalendarWidget'
import { CountdownPanel } from './components/CountdownPanel'
import { FocusPanel } from './components/FocusPanel'
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon } from './components/Icon'
import { OverviewStrip } from './components/OverviewStrip'
import { RitualsPanel } from './components/RitualsPanel'
import { SearchOverlay } from './components/SearchOverlay'
import { TopBar } from './components/TopBar'
import { addMonths, getDailySeed, getTodayKey, parseDateKey, startOfMonth } from './lib/date'
import { getEventsForDate } from './lib/holidays'
import { getEnabledQuotes } from './lib/quotes'
import { exportAppData, importAppData, loadAppData, persistAppData } from './lib/storage'
import {
  createEvent,
  createId,
  createRitual,
  createTask,
  type AppData,
  type DatePlan,
  type Quote,
  type Task,
  type TaskBucket,
  type ThemeMode,
} from './store/appData'

const THEME_CYCLE: ThemeMode[] = ['pearl', 'obsidian']

function playFeedbackSound(type: 'add' | 'complete' | 'delete' | 'surface', enabled: boolean) {
  if (!enabled) return

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return

  const ctx = new AudioContextCtor()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const config = {
    add: { frequency: 660, duration: 0.08 },
    complete: { frequency: 540, duration: 0.12 },
    delete: { frequency: 280, duration: 0.09 },
    surface: { frequency: 460, duration: 0.05 },
  }[type]

  osc.frequency.value = config.frequency
  gain.gain.value = 0.0001
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + config.duration)
  osc.stop(ctx.currentTime + config.duration)
  osc.addEventListener('ended', () => {
    void ctx.close()
  })
}

function getTaskList(appData: AppData, bucket: Exclude<TaskBucket, 'date'>) {
  return bucket === 'focus' ? appData.focusTasks : appData.backlogTasks
}

function setTaskList(appData: AppData, bucket: Exclude<TaskBucket, 'date'>, nextList: Task[]): AppData {
  return bucket === 'focus'
    ? { ...appData, focusTasks: nextList }
    : { ...appData, backlogTasks: nextList }
}

function QuoteManager({
  quotes,
  onClose,
  onAddQuote,
  onToggleQuote,
  onDeleteQuote,
}: {
  quotes: Quote[]
  onClose: () => void
  onAddQuote: (text: string, author: string) => void
  onToggleQuote: (quoteId: string) => void
  onDeleteQuote: (quoteId: string) => void
}) {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')

  return (
    <div className="overlay modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="quote-manager glass-panel"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Quote library</p>
            <h2>管理短句库</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭短句库">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form
          className="quote-form glass-ridge"
          onSubmit={(event) => {
            event.preventDefault()
            const nextText = text.trim()
            const nextAuthor = author.trim()
            if (!nextText || !nextAuthor) return
            onAddQuote(nextText, nextAuthor)
            setText('')
            setAuthor('')
          }}
        >
          <textarea
            className="note-field compact"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="写下一句你想在顶栏看到的话"
          />
          <div className="quote-form-row">
            <input
              className="field"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="作者或出处"
            />
            <button className="primary-button" type="submit" aria-label="新增短句">
              <PlusIcon width={18} height={18} />
            </button>
          </div>
        </form>

        <div className="quote-list">
          {quotes.map((quote) => (
            <article key={quote.id} className="quote-item glass-ridge">
              <div>
                <p>{quote.text}</p>
                <span>{quote.author} · {quote.source === 'custom' ? '自定义' : '内置'}</span>
              </div>
              <div className="quote-item-actions">
                <button
                  className={`chip-toggle ${quote.enabled ? 'enabled' : ''}`}
                  type="button"
                  onClick={() => onToggleQuote(quote.id)}
                >
                  {quote.enabled ? (
                    <>
                      <CheckIcon width={14} height={14} />
                      已启用
                    </>
                  ) : (
                    '已停用'
                  )}
                </button>
                {quote.source === 'custom' ? (
                  <button
                    className="ghost-button danger"
                    type="button"
                    onClick={() => onDeleteQuote(quote.id)}
                    aria-label="删除短句"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  const initialData = useMemo(() => loadAppData(), [])
  const todayKey = getTodayKey()
  const [appData, setAppData] = useState<AppData>(initialData)
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(parseDateKey(todayKey)))
  const [calendarStageOpen, setCalendarStageOpen] = useState(initialData.preferences.calendarExpandedDefault)
  const [quoteManagerOpen, setQuoteManagerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [quoteCursor, setQuoteCursor] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setInstallPrompt(promptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    persistAppData(appData)
    document.documentElement.dataset.theme = appData.preferences.theme
    document.documentElement.dataset.motion = appData.preferences.reducedMotion ? 'reduce' : 'default'
  }, [appData])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey

      if (isMetaOrCtrl && event.key === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }

      if (event.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false)
          return
        }
        if (quoteManagerOpen) {
          setQuoteManagerOpen(false)
          return
        }
        if (calendarStageOpen) {
          setCalendarStageOpen(false)
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, quoteManagerOpen, calendarStageOpen])

  const enabledQuotes = useMemo(() => getEnabledQuotes(appData.quotes), [appData.quotes])
  const activeQuote = enabledQuotes[quoteCursor % enabledQuotes.length] ?? enabledQuotes[0]

  useEffect(() => {
    if (appData.preferences.quoteMode === 'daily') {
      setQuoteCursor(getDailySeed(todayKey, enabledQuotes.length))
    } else {
      setQuoteCursor((prev) => prev % Math.max(enabledQuotes.length, 1))
    }
  }, [appData.preferences.quoteMode, enabledQuotes.length, todayKey])

  const selectedPlan =
    appData.datePlans[selectedDate] ??
    ({
      date: selectedDate,
      tasks: [],
      note: '',
    } satisfies DatePlan)

  const selectedEvents = getEventsForDate(appData.events, selectedDate)

  const updateBucketTask = (
    bucket: Exclude<TaskBucket, 'date'>,
    updater: (tasks: Task[]) => Task[],
  ) => {
    setAppData((prev) => setTaskList(prev, bucket, updater(getTaskList(prev, bucket))))
  }

  const handleDropTask = (
    targetBucket: Exclude<TaskBucket, 'date'>,
    fromBucket: Exclude<TaskBucket, 'date'>,
    taskId: string,
    targetId: string | null,
  ) => {
    setAppData((prev) => {
      const sourceList = [...getTaskList(prev, fromBucket)]
      const destinationList =
        fromBucket === targetBucket ? sourceList : [...getTaskList(prev, targetBucket)]
      const sourceIndex = sourceList.findIndex((task) => task.id === taskId)
      if (sourceIndex === -1) return prev

      const [task] = sourceList.splice(sourceIndex, 1)
      const destinationIndex = targetId
        ? destinationList.findIndex((item) => item.id === targetId)
        : -1
      const nextTask =
        fromBucket === targetBucket
          ? task
          : { ...task, bucket: targetBucket, updatedAt: new Date().toISOString() }

      if (fromBucket === targetBucket) {
        const insertIndex = destinationIndex === -1 ? sourceList.length : destinationIndex
        sourceList.splice(insertIndex, 0, nextTask)
        return setTaskList(prev, targetBucket, sourceList)
      }

      const insertIndex = destinationIndex === -1 ? destinationList.length : destinationIndex
      destinationList.splice(insertIndex, 0, nextTask)

      const nextSourceState = setTaskList(prev, fromBucket, sourceList)
      return setTaskList(nextSourceState, targetBucket, destinationList)
    })
  }

  const cycleTheme = () => {
    setAppData((prev) => {
      const currentIndex = THEME_CYCLE.indexOf(prev.preferences.theme)
      const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length]
      return {
        ...prev,
        preferences: { ...prev.preferences, theme: nextTheme },
      }
    })
  }

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          try {
            const imported = await importAppData(file)
            setAppData(imported)
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
        onNextQuote={() => setQuoteCursor((prev) => (prev + 1) % enabledQuotes.length)}
        onManageQuotes={() => setQuoteManagerOpen(true)}
        onToggleSound={() => {
          playFeedbackSound('surface', appData.preferences.soundEnabled)
          setAppData((prev) => ({
            ...prev,
            preferences: { ...prev.preferences, soundEnabled: !prev.preferences.soundEnabled },
          }))
        }}
        onToggleTheme={cycleTheme}
        onToggleMotion={() =>
          setAppData((prev) => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              reducedMotion: !prev.preferences.reducedMotion,
            },
          }))
        }
        onToggleQuoteMode={() =>
          setAppData((prev) => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              quoteMode: prev.preferences.quoteMode === 'daily' ? 'random' : 'daily',
            },
          }))
        }
        onToggleCalendarDefault={() =>
          setAppData((prev) => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              calendarExpandedDefault: !prev.preferences.calendarExpandedDefault,
            },
          }))
        }
        onExport={() => exportAppData(appData)}
        onImport={() => fileInputRef.current?.click()}
        onInstall={async () => {
          if (!installPrompt) return
          await installPrompt.prompt()
          setInstallPrompt(null)
        }}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main className="workspace-board">
        <section className="today-rail" aria-label="今日工作区">
          <OverviewStrip
            todayKey={todayKey}
            selectedDate={selectedDate}
            focusTasks={appData.focusTasks}
            backlogTasks={appData.backlogTasks}
            rituals={appData.rituals}
            selectedPlan={selectedPlan}
            events={selectedEvents}
          />

          <FocusPanel
            tasks={appData.focusTasks}
            onAdd={(text) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              updateBucketTask('focus', (tasks) => [createTask(text, 'focus'), ...tasks])
            }}
            onToggle={(taskId) => {
              playFeedbackSound('complete', appData.preferences.soundEnabled)
              updateBucketTask('focus', (tasks) =>
                tasks.map((task) =>
                  task.id === taskId
                    ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
                    : task,
                ),
              )
            }}
            onDelete={(taskId) => {
              playFeedbackSound('delete', appData.preferences.soundEnabled)
              updateBucketTask('focus', (tasks) => tasks.filter((task) => task.id !== taskId))
            }}
            onUpdate={(taskId, text) =>
              updateBucketTask('focus', (tasks) =>
                tasks.map((task) =>
                  task.id === taskId ? { ...task, text, updatedAt: new Date().toISOString() } : task,
                ),
              )
            }
            onDropTask={(fromBucket, taskId, targetId) =>
              handleDropTask('focus', fromBucket, taskId, targetId)
            }
          />
        </section>

        <section className="time-board" aria-label="时间板">
          <CalendarWidget
            appData={appData}
            todayKey={todayKey}
            selectedDate={selectedDate}
            viewDate={calendarMonth}
            onPrevMonth={() => setCalendarMonth((prev) => addMonths(prev, -1))}
            onNextMonth={() => setCalendarMonth((prev) => addMonths(prev, 1))}
            onSelectDate={(dateKey) => {
              setSelectedDate(dateKey)
              setCalendarMonth(startOfMonth(parseDateKey(dateKey)))
            }}
            onOpenStage={() => {
              playFeedbackSound('surface', appData.preferences.soundEnabled)
              setCalendarStageOpen(true)
            }}
          />

          <CountdownPanel
            events={appData.events}
            onAdd={(title, date, type) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              setAppData((prev) => ({
                ...prev,
                events: [createEvent(title, date, type), ...prev.events],
              }))
            }}
            onDelete={(eventId) => {
              playFeedbackSound('delete', appData.preferences.soundEnabled)
              setAppData((prev) => ({
                ...prev,
                events: prev.events.filter((event) => event.id !== eventId),
              }))
            }}
          />
        </section>

        <aside className="capture-rail" aria-label="收纳区">
          <BacklogPanel
            tasks={appData.backlogTasks}
            onAdd={(text) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              updateBucketTask('backlog', (tasks) => [createTask(text, 'backlog'), ...tasks])
            }}
            onToggle={(taskId) => {
              playFeedbackSound('complete', appData.preferences.soundEnabled)
              updateBucketTask('backlog', (tasks) =>
                tasks.map((task) =>
                  task.id === taskId
                    ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
                    : task,
                ),
              )
            }}
            onDelete={(taskId) => {
              playFeedbackSound('delete', appData.preferences.soundEnabled)
              updateBucketTask('backlog', (tasks) => tasks.filter((task) => task.id !== taskId))
            }}
            onUpdate={(taskId, text) =>
              updateBucketTask('backlog', (tasks) =>
                tasks.map((task) =>
                  task.id === taskId ? { ...task, text, updatedAt: new Date().toISOString() } : task,
                ),
              )
            }
            onDropTask={(fromBucket, taskId, targetId) =>
              handleDropTask('backlog', fromBucket, taskId, targetId)
            }
            onClearCompleted={() =>
              updateBucketTask('backlog', (tasks) => tasks.filter((task) => !task.completed))
            }
          />

          <RitualsPanel
            rituals={appData.rituals}
            todayKey={todayKey}
            onAdd={(text) => {
              playFeedbackSound('add', appData.preferences.soundEnabled)
              setAppData((prev) => ({ ...prev, rituals: [createRitual(text), ...prev.rituals] }))
            }}
            onToggle={(ritualId, dateKey) => {
              playFeedbackSound('complete', appData.preferences.soundEnabled)
              setAppData((prev) => ({
                ...prev,
                rituals: prev.rituals.map((ritual) => {
                  if (ritual.id !== ritualId) return ritual
                  const history = { ...ritual.completionHistory }
                  if (history[dateKey]) delete history[dateKey]
                  else history[dateKey] = true
                  return {
                    ...ritual,
                    completionHistory: history,
                    updatedAt: new Date().toISOString(),
                  }
                }),
              }))
            }}
            onDelete={(ritualId) =>
              setAppData((prev) => ({
                ...prev,
                rituals: prev.rituals.filter((ritual) => ritual.id !== ritualId),
              }))
            }
            onUpdate={(ritualId, text) =>
              setAppData((prev) => ({
                ...prev,
                rituals: prev.rituals.map((ritual) =>
                  ritual.id === ritualId
                    ? { ...ritual, text, updatedAt: new Date().toISOString() }
                    : ritual,
                ),
              }))
            }
            onDropRitual={(ritualId, targetId) => {
              setAppData((prev) => {
                const nextRituals = [...prev.rituals]
                const sourceIndex = nextRituals.findIndex((r) => r.id === ritualId)
                const targetIndex = nextRituals.findIndex((r) => r.id === targetId)
                if (sourceIndex === -1 || targetIndex === -1) return prev

                const [removed] = nextRituals.splice(sourceIndex, 1)
                nextRituals.splice(targetIndex, 0, removed)
                return { ...prev, rituals: nextRituals }
              })
            }}
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
          onPrevMonth={() => setCalendarMonth((prev) => addMonths(prev, -1))}
          onNextMonth={() => setCalendarMonth((prev) => addMonths(prev, 1))}
          onSelectDate={(dateKey) => {
            setSelectedDate(dateKey)
            setCalendarMonth(startOfMonth(parseDateKey(dateKey)))
          }}
        />
      ) : null}

      {quoteManagerOpen ? (
        <QuoteManager
          quotes={appData.quotes}
          onClose={() => setQuoteManagerOpen(false)}
          onAddQuote={(text, author) =>
            setAppData((prev) => ({
              ...prev,
              quotes: [
                ...prev.quotes,
                {
                  id: createId('quote'),
                  text,
                  author,
                  enabled: true,
                  source: 'custom',
                },
              ],
            }))
          }
          onToggleQuote={(quoteId) =>
            setAppData((prev) => ({
              ...prev,
              quotes: prev.quotes.map((quote) =>
                quote.id === quoteId ? { ...quote, enabled: !quote.enabled } : quote,
              ),
            }))
          }
          onDeleteQuote={(quoteId) =>
            setAppData((prev) => ({
              ...prev,
              quotes: prev.quotes.filter((quote) => quote.id !== quoteId),
            }))
          }
        />
      ) : null}

      {searchOpen ? (
        <SearchOverlay
          appData={appData}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </div>
  )
}

export default App
