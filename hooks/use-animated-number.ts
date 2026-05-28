'use client'

import { useEffect, useRef, useState } from 'react'

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function useAnimatedNumber(target: number, durationMs = 650): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const from = displayRef.current
    if (from === target) return

    const start = performance.now()

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = easeOutCubic(progress)
      const next = Math.round(from + (target - from) * eased)
      displayRef.current = next
      setDisplay(next)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        displayRef.current = target
        setDisplay(target)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [target, durationMs])

  return display
}
