import { useEffect, useReducer, useRef, useState } from 'react'

import {
  createPomodoroState,
  normalizePomodoroConfig,
  reducePomodoro,
  type PomodoroMode,
} from '../lib/pomodoro'
import type { PomodoroConfig } from '../store/appData'
import { CloseIcon, PauseIcon, PlayIcon, ResetIcon } from './Icon'
import { DialogShell } from './DialogShell'

interface PomodoroTimerProps {
  config: PomodoroConfig
  soundEnabled: boolean
  onConfigChange: (config: PomodoroConfig) => void
}

const CIRCUMFERENCE = 2 * Math.PI * 11

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: '专注',
  shortBreak: '短休',
  longBreak: '长休',
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function PomodoroTimer({
  config,
  soundEnabled,
  onConfigChange,
}: PomodoroTimerProps) {
  const [state, dispatch] = useReducer(reducePomodoro, config, createPomodoroState)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [configDraft, setConfigDraft] = useState(() => normalizePomodoroConfig(config))
  const [announcement, setAnnouncement] = useState('')
  const [isDoneFlash, setIsDoneFlash] = useState(false)
  const handledCompletionRef = useRef(0)
  const doneTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    dispatch({ type: 'configure', config })
  }, [config])

  useEffect(() => {
    if (state.phase !== 'running') return

    const synchronize = () => dispatch({ type: 'sync', now: Date.now() })
    const interval = window.setInterval(synchronize, 1000)
    window.addEventListener('focus', synchronize)
    document.addEventListener('visibilitychange', synchronize)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', synchronize)
      document.removeEventListener('visibilitychange', synchronize)
    }
  }, [state.phase])

  useEffect(() => {
    if (state.completionSeq <= handledCompletionRef.current) return
    handledCompletionRef.current = state.completionSeq
    const suggestion = state.suggestedMode ? MODE_LABELS[state.suggestedMode] : '下一轮'
    setAnnouncement(`${MODE_LABELS[state.mode]}结束，建议${suggestion}`)
    setIsDoneFlash(true)
    if (doneTimeoutRef.current !== null) window.clearTimeout(doneTimeoutRef.current)
    doneTimeoutRef.current = window.setTimeout(() => {
      doneTimeoutRef.current = null
      setIsDoneFlash(false)
    }, 2000)

    if (!soundEnabled) return
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    const previousContext = audioContextRef.current
    audioContextRef.current = null
    if (previousContext && previousContext.state !== 'closed') {
      void previousContext.close().catch(() => undefined)
    }

    try {
      const context = new AudioContextCtor()
      audioContextRef.current = context
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = 880
      gain.gain.value = 0.0001
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6)
      oscillator.stop(context.currentTime + 0.6)
      oscillator.addEventListener('ended', () => {
        if (audioContextRef.current !== context) return
        audioContextRef.current = null
        void context.close().catch(() => undefined)
      }, { once: true })
    } catch {
      const context = audioContextRef.current
      audioContextRef.current = null
      if (context && context.state !== 'closed') {
        void context.close().catch(() => undefined)
      }
    }
  }, [soundEnabled, state.completionSeq, state.mode, state.suggestedMode])

  useEffect(() => () => {
    if (doneTimeoutRef.current !== null) window.clearTimeout(doneTimeoutRef.current)
    const context = audioContextRef.current
    audioContextRef.current = null
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }, [])

  const progress = state.durationSeconds === 0
    ? 0
    : 1 - state.remainingSeconds / state.durationSeconds
  const offset = CIRCUMFERENCE * (1 - progress)
  const displayTime = formatTime(state.remainingSeconds)
  const active = state.phase === 'running' || state.phase === 'paused'
  const toggleLabel = state.phase === 'running'
    ? '暂停番茄钟'
    : state.phase === 'paused'
      ? `继续${MODE_LABELS[state.mode]}`
      : `开始${MODE_LABELS[state.suggestedMode ?? state.mode]}`

  const clearCompletionFeedback = () => {
    if (doneTimeoutRef.current !== null) {
      window.clearTimeout(doneTimeoutRef.current)
      doneTimeoutRef.current = null
    }
    setIsDoneFlash(false)
    setAnnouncement('')
    const context = audioContextRef.current
    audioContextRef.current = null
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }

  const handleToggle = () => {
    if (state.phase === 'running') {
      dispatch({ type: 'pause', now: Date.now() })
      return
    }
    if (state.phase === 'completed') {
      clearCompletionFeedback()
      dispatch({ type: 'move-to-suggestion', now: Date.now(), start: true })
      return
    }
    dispatch({ type: 'start', now: Date.now() })
  }

  const handleReset = () => {
    clearCompletionFeedback()
    dispatch({ type: 'reset' })
  }

  const handleSuggestion = (start: boolean) => {
    clearCompletionFeedback()
    dispatch({ type: 'move-to-suggestion', now: Date.now(), start })
  }

  const updateConfigDraft = (key: keyof PomodoroConfig, value: number) => {
    if (!Number.isFinite(value)) return
    setConfigDraft((current) => ({ ...current, [key]: value }))
  }

  const saveConfig = () => {
    const normalized = normalizePomodoroConfig(configDraft)
    setConfigDraft(normalized)
    dispatch({ type: 'configure', config: normalized })
    onConfigChange(normalized)
  }

  const openDialog = () => {
    setConfigDraft(normalizePomodoroConfig(config))
    setDialogOpen(true)
  }

  return (
    <>
      <div
        className={`pomodoro-widget ${state.phase === 'running' ? 'active' : ''} ${isDoneFlash ? 'done-flash' : ''}`}
      >
        <button
          className="pomodoro-open-button"
          type="button"
          onClick={openDialog}
          aria-label="打开番茄钟"
          aria-haspopup="dialog"
          aria-expanded={dialogOpen}
        >
          <span className="pomodoro-ring" aria-hidden="true">
            <svg viewBox="0 0 28 28">
              <circle className="ring-bg" cx="14" cy="14" r="11" />
              <circle
                className="ring-fill"
                cx="14"
                cy="14"
                r="11"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
              />
            </svg>
          </span>
          <span className="pomodoro-compact-mode">{MODE_LABELS[state.mode]}</span>
          <span role="timer" aria-label={`${MODE_LABELS[state.mode]}剩余 ${displayTime}`}>
            {displayTime}
          </span>
        </button>
        <button
          className="icon-button pomodoro-btn"
          type="button"
          onClick={handleToggle}
          aria-label={toggleLabel}
        >
          {state.phase === 'running'
            ? <PauseIcon width={12} height={12} />
            : <PlayIcon width={12} height={12} />}
        </button>
        {state.phase !== 'idle' ? (
          <button
            className="icon-button pomodoro-btn"
            type="button"
            onClick={handleReset}
            aria-label="重置番茄钟"
          >
            <ResetIcon width={12} height={12} />
          </button>
        ) : null}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      </div>

      {dialogOpen ? (
        <DialogShell
          ariaLabel="番茄钟"
          className="pomodoro-dialog"
          onClose={() => setDialogOpen(false)}
        >
          <section className="dialog-surface pomodoro-sheet">
            <header className="drawer-header pomodoro-dialog-header">
              <div>
                <h2>番茄钟</h2>
                <p>{MODE_LABELS[state.mode]}</p>
              </div>
              <button
                className="icon-button compact"
                type="button"
                onClick={() => setDialogOpen(false)}
                aria-label="关闭番茄钟"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </header>

            <fieldset className="pomodoro-mode-group">
              <legend className="sr-only">计时模式</legend>
              {(Object.keys(MODE_LABELS) as PomodoroMode[]).map((mode) => (
                <label key={mode}>
                  <input
                    type="radio"
                    name="pomodoro-mode"
                    value={mode}
                    checked={state.mode === mode}
                    disabled={active}
                    onChange={() => dispatch({ type: 'select-mode', mode })}
                  />
                  <span>{MODE_LABELS[mode]}</span>
                </label>
              ))}
            </fieldset>

            <div className="pomodoro-dialog-clock">
              <strong role="timer" aria-label={`${MODE_LABELS[state.mode]}剩余 ${displayTime}`}>
                {displayTime}
              </strong>
              <progress
                max={state.durationSeconds}
                value={state.durationSeconds - state.remainingSeconds}
                aria-label={`${MODE_LABELS[state.mode]}进度`}
              />
            </div>

            <div className="pomodoro-rounds" role="group" aria-label="专注轮次">
              <div className="pomodoro-rounds-heading">
                <span>本轮</span>
                <strong>
                  {Math.min(state.focusRoundsInCycle, state.config.roundsPerCycle)}/
                  {state.config.roundsPerCycle}
                </strong>
                <button
                  className="tertiary-button"
                  type="button"
                  onClick={() => dispatch({ type: 'clear-rounds' })}
                  disabled={state.focusRoundsInCycle === 0}
                  aria-label="清空轮次"
                >
                  清空
                </button>
              </div>
              <div className="pomodoro-round-dots" aria-hidden="true">
                {Array.from({ length: state.config.roundsPerCycle }, (_, index) => (
                  <i
                    key={index}
                    className={index < state.focusRoundsInCycle ? 'complete' : ''}
                  />
                ))}
              </div>
            </div>

            {state.phase === 'completed' && state.suggestedMode ? (
              <section className="pomodoro-completion-card" aria-label="下一轮建议">
                <p>建议{MODE_LABELS[state.suggestedMode]}</p>
                <div className="pomodoro-dialog-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => handleSuggestion(true)}
                  >
                    开始{MODE_LABELS[state.suggestedMode]}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleSuggestion(false)}
                  >
                    稍后
                  </button>
                </div>
              </section>
            ) : (
              <div className="pomodoro-dialog-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleToggle}
                >
                  {state.phase === 'running'
                    ? '暂停'
                    : state.phase === 'paused'
                      ? '继续'
                      : '开始'}
                </button>
                {state.phase !== 'idle' ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={handleReset}
                  >
                    重置
                  </button>
                ) : null}
              </div>
            )}

            <section className="pomodoro-settings" aria-labelledby="pomodoro-settings-title">
              <div className="pomodoro-settings-heading">
                <h3 id="pomodoro-settings-title">时长设置</h3>
                <button className="secondary-button" type="button" onClick={saveConfig}>
                  保存设置
                </button>
              </div>
              <div className="pomodoro-settings-grid">
                <label>
                  <span>专注</span>
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    value={configDraft.focusMinutes}
                    onChange={(event) => updateConfigDraft('focusMinutes', event.currentTarget.valueAsNumber)}
                    aria-label="专注时长"
                  />
                </label>
                <label>
                  <span>短休</span>
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    value={configDraft.shortBreakMinutes}
                    onChange={(event) => updateConfigDraft('shortBreakMinutes', event.currentTarget.valueAsNumber)}
                    aria-label="短休时长"
                  />
                </label>
                <label>
                  <span>长休</span>
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    value={configDraft.longBreakMinutes}
                    onChange={(event) => updateConfigDraft('longBreakMinutes', event.currentTarget.valueAsNumber)}
                    aria-label="长休时长"
                  />
                </label>
                <label>
                  <span>轮次</span>
                  <input
                    className="field"
                    type="number"
                    min="2"
                    max="12"
                    step="1"
                    value={configDraft.roundsPerCycle}
                    onChange={(event) => updateConfigDraft('roundsPerCycle', event.currentTarget.valueAsNumber)}
                    aria-label="长休轮次"
                  />
                </label>
              </div>
            </section>
          </section>
        </DialogShell>
      ) : null}
    </>
  )
}
