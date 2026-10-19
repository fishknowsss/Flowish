import { useEffect, useState } from 'react'

import { getTodayKey } from './date'

function millisecondsUntilTomorrow(now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1_000, tomorrow.getTime() - now.getTime() + 1_000)
}

export function useTodayKey() {
  const [todayKey, setTodayKey] = useState(getTodayKey)

  useEffect(() => {
    let timer = 0

    const schedule = () => {
      window.clearTimeout(timer)
      setTodayKey(getTodayKey())
      timer = window.setTimeout(schedule, millisecondsUntilTomorrow())
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule()
    }

    schedule()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return todayKey
}
