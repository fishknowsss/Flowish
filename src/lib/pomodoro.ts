import {
  DEFAULT_POMODORO_LONG_BREAK_INTERVAL,
  DEFAULT_POMODORO_LONG_BREAK_MINUTES,
  DEFAULT_POMODORO_MINUTES,
  DEFAULT_POMODORO_SHORT_BREAK_MINUTES,
  MAX_POMODORO_LONG_BREAK_INTERVAL,
  MAX_POMODORO_MINUTES,
  MIN_POMODORO_LONG_BREAK_INTERVAL,
  MIN_POMODORO_MINUTES,
  type PomodoroConfig,
} from '../store/appData'

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak'
export type PomodoroPhase = 'idle' | 'running' | 'paused' | 'completed'

export interface PomodoroState {
  config: PomodoroConfig
  mode: PomodoroMode
  phase: PomodoroPhase
  durationSeconds: number
  remainingSeconds: number
  deadlineMs: number | null
  focusRoundsInCycle: number
  suggestedMode: PomodoroMode | null
  completionSeq: number
}

export type PomodoroAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'sync'; now: number }
  | { type: 'move-to-suggestion'; now: number; start: boolean }
  | { type: 'select-mode'; mode: PomodoroMode }
  | { type: 'configure'; config: PomodoroConfig }
  | { type: 'reset' }
  | { type: 'clear-rounds' }

function normalizeInteger(value: number, minimum: number, maximum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

export function normalizePomodoroConfig(config: PomodoroConfig): PomodoroConfig {
  return {
    focusMinutes: normalizeInteger(
      config.focusMinutes,
      MIN_POMODORO_MINUTES,
      MAX_POMODORO_MINUTES,
      DEFAULT_POMODORO_MINUTES,
    ),
    shortBreakMinutes: normalizeInteger(
      config.shortBreakMinutes,
      MIN_POMODORO_MINUTES,
      MAX_POMODORO_MINUTES,
      DEFAULT_POMODORO_SHORT_BREAK_MINUTES,
    ),
    longBreakMinutes: normalizeInteger(
      config.longBreakMinutes,
      MIN_POMODORO_MINUTES,
      MAX_POMODORO_MINUTES,
      DEFAULT_POMODORO_LONG_BREAK_MINUTES,
    ),
    roundsPerCycle: normalizeInteger(
      config.roundsPerCycle,
      MIN_POMODORO_LONG_BREAK_INTERVAL,
      MAX_POMODORO_LONG_BREAK_INTERVAL,
      DEFAULT_POMODORO_LONG_BREAK_INTERVAL,
    ),
  }
}

function getDurationSeconds(config: PomodoroConfig, mode: PomodoroMode) {
  const minutes = mode === 'focus'
    ? config.focusMinutes
    : mode === 'shortBreak'
      ? config.shortBreakMinutes
      : config.longBreakMinutes
  return minutes * 60
}

export function createPomodoroState(config: PomodoroConfig): PomodoroState {
  const normalizedConfig = normalizePomodoroConfig(config)
  const durationSeconds = getDurationSeconds(normalizedConfig, 'focus')
  return {
    config: normalizedConfig,
    mode: 'focus',
    phase: 'idle',
    durationSeconds,
    remainingSeconds: durationSeconds,
    deadlineMs: null,
    focusRoundsInCycle: 0,
    suggestedMode: null,
    completionSeq: 0,
  }
}

export function reducePomodoro(
  state: PomodoroState,
  action: PomodoroAction,
): PomodoroState {
  if (action.type === 'clear-rounds') {
    return {
      ...state,
      focusRoundsInCycle: 0,
      suggestedMode:
        state.phase === 'completed' && state.mode === 'focus'
          ? 'shortBreak'
          : state.suggestedMode,
    }
  }

  if (action.type === 'configure') {
    const config = normalizePomodoroConfig(action.config)
    if (state.phase !== 'idle') return { ...state, config }
    const durationSeconds = getDurationSeconds(config, state.mode)
    return {
      ...state,
      config,
      durationSeconds,
      remainingSeconds: durationSeconds,
    }
  }

  if (action.type === 'reset') {
    const durationSeconds = getDurationSeconds(state.config, state.mode)
    return {
      ...state,
      phase: 'idle',
      durationSeconds,
      remainingSeconds: durationSeconds,
      deadlineMs: null,
      suggestedMode: null,
    }
  }

  if (action.type === 'select-mode') {
    if (state.phase === 'running' || state.phase === 'paused') return state
    const durationSeconds = getDurationSeconds(state.config, action.mode)
    return {
      ...state,
      mode: action.mode,
      phase: 'idle',
      durationSeconds,
      remainingSeconds: durationSeconds,
      deadlineMs: null,
      suggestedMode: null,
    }
  }

  if (action.type === 'move-to-suggestion') {
    if (state.phase !== 'completed' || state.suggestedMode === null) return state
    const durationSeconds = getDurationSeconds(state.config, state.suggestedMode)
    return {
      ...state,
      mode: state.suggestedMode,
      phase: action.start ? 'running' : 'idle',
      durationSeconds,
      remainingSeconds: durationSeconds,
      deadlineMs: action.start ? action.now + durationSeconds * 1000 : null,
      suggestedMode: null,
    }
  }

  if (action.type === 'start') {
    if (state.phase !== 'idle' && state.phase !== 'paused') return state
    return {
      ...state,
      phase: 'running',
      deadlineMs: action.now + state.remainingSeconds * 1000,
    }
  }

  if (state.phase !== 'running' || state.deadlineMs === null) return state
  const remainingSeconds = Math.max(0, Math.ceil((state.deadlineMs - action.now) / 1000))
  if (remainingSeconds === 0) {
    const completedFocus = state.mode === 'focus'
    const focusRoundsInCycle = completedFocus
      ? state.focusRoundsInCycle + 1
      : state.mode === 'longBreak'
        ? 0
        : state.focusRoundsInCycle
    return {
      ...state,
      phase: 'completed',
      remainingSeconds: 0,
      deadlineMs: null,
      focusRoundsInCycle,
      suggestedMode: completedFocus
        ? focusRoundsInCycle >= state.config.roundsPerCycle
          ? 'longBreak'
          : 'shortBreak'
        : 'focus',
      completionSeq: state.completionSeq + 1,
    }
  }
  if (action.type === 'pause') {
    return {
      ...state,
      phase: 'paused',
      remainingSeconds,
      deadlineMs: null,
    }
  }
  return { ...state, remainingSeconds }
}
