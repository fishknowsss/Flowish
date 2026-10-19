import { describe, expect, it } from 'vitest'

import type { PomodoroConfig } from '../store/appData'
import { createPomodoroState, normalizePomodoroConfig, reducePomodoro } from './pomodoro'

const config: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsPerCycle: 4,
}

describe('pomodoro state', () => {
  it('normalizes unsafe durations and round counts before creating a session', () => {
    expect(normalizePomodoroConfig({
      focusMinutes: 0,
      shortBreakMinutes: Number.NaN,
      longBreakMinutes: 999,
      roundsPerCycle: 1,
    })).toEqual({
      focusMinutes: 1,
      shortBreakMinutes: 5,
      longBreakMinutes: 180,
      roundsPerCycle: 2,
    })
  })

  it('uses an absolute deadline when a running session is synchronized', () => {
    const initial = createPomodoroState(config)
    const running = reducePomodoro(initial, { type: 'start', now: 1_000 })
    const synchronized = reducePomodoro(running, { type: 'sync', now: 46_000 })

    expect(synchronized).toMatchObject({
      mode: 'focus',
      phase: 'running',
      durationSeconds: 1_500,
      remainingSeconds: 1_455,
      deadlineMs: 1_501_000,
    })
  })

  it('freezes a paused session and resumes from its remaining time', () => {
    const initial = createPomodoroState({ ...config, focusMinutes: 1 })
    const running = reducePomodoro(initial, { type: 'start', now: 1_000 })
    const paused = reducePomodoro(running, { type: 'pause', now: 21_000 })
    const unchanged = reducePomodoro(paused, { type: 'sync', now: 121_000 })
    const resumed = reducePomodoro(unchanged, { type: 'start', now: 121_000 })

    expect(paused).toMatchObject({
      phase: 'paused',
      remainingSeconds: 40,
      deadlineMs: null,
    })
    expect(unchanged).toBe(paused)
    expect(resumed).toMatchObject({
      phase: 'running',
      remainingSeconds: 40,
      deadlineMs: 161_000,
    })
  })

  it('completes a focus round once and suggests a short break', () => {
    const initial = createPomodoroState({ ...config, focusMinutes: 1 })
    const running = reducePomodoro(initial, { type: 'start', now: 1_000 })
    const completed = reducePomodoro(running, { type: 'sync', now: 61_000 })
    const repeated = reducePomodoro(completed, { type: 'sync', now: 62_000 })

    expect(completed).toMatchObject({
      phase: 'completed',
      remainingSeconds: 0,
      deadlineMs: null,
      focusRoundsInCycle: 1,
      suggestedMode: 'shortBreak',
      completionSeq: 1,
    })
    expect(repeated).toBe(completed)
  })

  it('waits for an explicit choice before preparing or starting the suggested break', () => {
    const initial = createPomodoroState({ ...config, focusMinutes: 1 })
    const running = reducePomodoro(initial, { type: 'start', now: 1_000 })
    const completed = reducePomodoro(running, { type: 'sync', now: 61_000 })
    const prepared = reducePomodoro(completed, {
      type: 'move-to-suggestion',
      now: 70_000,
      start: false,
    })
    const started = reducePomodoro(completed, {
      type: 'move-to-suggestion',
      now: 70_000,
      start: true,
    })

    expect(prepared).toMatchObject({
      mode: 'shortBreak',
      phase: 'idle',
      durationSeconds: 300,
      remainingSeconds: 300,
      deadlineMs: null,
      suggestedMode: null,
    })
    expect(started).toMatchObject({
      mode: 'shortBreak',
      phase: 'running',
      durationSeconds: 300,
      remainingSeconds: 300,
      deadlineMs: 370_000,
      suggestedMode: null,
    })
  })

  it('returns to focus after a short break without changing the completed focus rounds', () => {
    const minuteConfig = { ...config, focusMinutes: 1, shortBreakMinutes: 1 }
    const focus = reducePomodoro(createPomodoroState(minuteConfig), {
      type: 'start',
      now: 0,
    })
    const focusDone = reducePomodoro(focus, { type: 'sync', now: 60_000 })
    const breakRunning = reducePomodoro(focusDone, {
      type: 'move-to-suggestion',
      now: 70_000,
      start: true,
    })
    const breakDone = reducePomodoro(breakRunning, { type: 'sync', now: 130_000 })

    expect(breakDone).toMatchObject({
      mode: 'shortBreak',
      phase: 'completed',
      focusRoundsInCycle: 1,
      suggestedMode: 'focus',
      completionSeq: 2,
    })
  })

  it('suggests a long break after the configured number of focus rounds', () => {
    const twoRoundConfig = {
      ...config,
      focusMinutes: 1,
      shortBreakMinutes: 1,
      roundsPerCycle: 2,
    }
    const firstFocus = reducePomodoro(createPomodoroState(twoRoundConfig), {
      type: 'start',
      now: 0,
    })
    const firstFocusDone = reducePomodoro(firstFocus, { type: 'sync', now: 60_000 })
    const shortBreak = reducePomodoro(firstFocusDone, {
      type: 'move-to-suggestion',
      now: 70_000,
      start: true,
    })
    const shortBreakDone = reducePomodoro(shortBreak, { type: 'sync', now: 130_000 })
    const secondFocus = reducePomodoro(shortBreakDone, {
      type: 'move-to-suggestion',
      now: 140_000,
      start: true,
    })
    const secondFocusDone = reducePomodoro(secondFocus, { type: 'sync', now: 200_000 })

    expect(secondFocusDone).toMatchObject({
      mode: 'focus',
      phase: 'completed',
      focusRoundsInCycle: 2,
      suggestedMode: 'longBreak',
    })
  })

  it('switches mode while idle without discarding an active session', () => {
    const initial = createPomodoroState(config)
    const shortBreak = reducePomodoro(initial, {
      type: 'select-mode',
      mode: 'shortBreak',
    })
    const running = reducePomodoro(shortBreak, { type: 'start', now: 10_000 })
    const refusedSwitch = reducePomodoro(running, {
      type: 'select-mode',
      mode: 'longBreak',
    })

    expect(shortBreak).toMatchObject({
      mode: 'shortBreak',
      phase: 'idle',
      durationSeconds: 300,
      remainingSeconds: 300,
    })
    expect(refusedSwitch).toBe(running)
  })

  it('resets the focus round cycle after a completed long break', () => {
    const twoRoundConfig = {
      ...config,
      focusMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 1,
      roundsPerCycle: 2,
    }
    let state = createPomodoroState(twoRoundConfig)
    state = reducePomodoro(state, { type: 'start', now: 0 })
    state = reducePomodoro(state, { type: 'sync', now: 60_000 })
    state = reducePomodoro(state, { type: 'move-to-suggestion', now: 70_000, start: true })
    state = reducePomodoro(state, { type: 'sync', now: 130_000 })
    state = reducePomodoro(state, { type: 'move-to-suggestion', now: 140_000, start: true })
    state = reducePomodoro(state, { type: 'sync', now: 200_000 })
    state = reducePomodoro(state, { type: 'move-to-suggestion', now: 210_000, start: true })
    state = reducePomodoro(state, { type: 'sync', now: 270_000 })

    expect(state).toMatchObject({
      mode: 'longBreak',
      phase: 'completed',
      focusRoundsInCycle: 0,
      suggestedMode: 'focus',
    })
  })

  it('freezes the active duration and applies a new configuration after reset', () => {
    const initial = createPomodoroState({ ...config, focusMinutes: 1 })
    const running = reducePomodoro(initial, { type: 'start', now: 0 })
    const synchronized = reducePomodoro(running, { type: 'sync', now: 20_000 })
    const configured = reducePomodoro(synchronized, {
      type: 'configure',
      config: { ...config, focusMinutes: 5 },
    })
    const reset = reducePomodoro(configured, { type: 'reset' })

    expect(configured).toMatchObject({
      phase: 'running',
      durationSeconds: 60,
      remainingSeconds: 40,
      deadlineMs: 60_000,
      config: { focusMinutes: 5 },
    })
    expect(reset).toMatchObject({
      phase: 'idle',
      durationSeconds: 300,
      remainingSeconds: 300,
      deadlineMs: null,
    })
  })

  it('clears the completed focus rounds without changing the current session', () => {
    const running = reducePomodoro(createPomodoroState({ ...config, focusMinutes: 1 }), {
      type: 'start',
      now: 0,
    })
    const completed = reducePomodoro(running, { type: 'sync', now: 60_000 })
    const cleared = reducePomodoro(completed, { type: 'clear-rounds' })

    expect(cleared).toMatchObject({
      phase: 'completed',
      remainingSeconds: 0,
      focusRoundsInCycle: 0,
    })
  })
})
