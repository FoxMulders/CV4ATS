'use client'

/**
 * Purpose: Client-side countdown state machine for API rate-limit backoff UI.
 * Upstream dependencies: window timers; consumed by hiring panel retry controls.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type RateLimitCooldownState = {
  secondsLeft: number
  isCoolingDown: boolean
  startCooldown: (seconds: number) => void
  clearCooldown: () => void
}

export function useRateLimitCooldown(onComplete?: () => void): RateLimitCooldownState {
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!cooldownUntil) return

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        setCooldownUntil(null)
        onCompleteRef.current?.()
      }
    }

    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [cooldownUntil])

  const startCooldown = useCallback((seconds: number) => {
    const safeSeconds = Math.max(1, Math.ceil(seconds))
    setCooldownUntil(Date.now() + safeSeconds * 1000)
    setSecondsLeft(safeSeconds)
  }, [])

  const clearCooldown = useCallback(() => {
    setCooldownUntil(null)
    setSecondsLeft(0)
  }, [])

  return {
    secondsLeft,
    isCoolingDown: secondsLeft > 0,
    startCooldown,
    clearCooldown,
  }
}
