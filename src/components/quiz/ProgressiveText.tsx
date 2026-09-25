'use client'

import { useEffect, useState } from 'react'

// 問題文を1文字ずつ表示する。startedAt は performance.now() 基準。
// 新しい読み上げのたびに親側で key を変えて作り直す前提。
export default function ProgressiveText({
  text,
  from = 0,
  startedAt,
  charMs,
  stopped = null,
  className = '',
}: {
  text: string
  from?: number
  startedAt: number | null
  charMs: number
  stopped?: number | null
  className?: string
}) {
  const [count, setCount] = useState(from)

  useEffect(() => {
    if (stopped !== null || startedAt === null) return
    let raf = 0
    const tick = () => {
      const n = Math.min(text.length, from + Math.floor((performance.now() - startedAt) / charMs))
      setCount(n)
      if (n < text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, from, startedAt, charMs, stopped])

  const shown = stopped ?? count
  const done = shown >= text.length

  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {text.slice(0, shown)}
      {!done && (
        <span className={`ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-indigo-500 ${stopped === null ? 'animate-pulse' : ''}`} />
      )}
    </p>
  )
}
