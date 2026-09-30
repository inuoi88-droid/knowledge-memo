'use client'

import { useEffect, useState, type CSSProperties } from 'react'

export const VISUAL_REVEAL_MS = 8000

// 外部URLの画像をそのまま表示する（保存・変換なし）。読み込めない画像は枠ごと隠す。
export function QuizImage({ src, className = '', style }: { src: string; className?: string; style?: CSSProperties }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    // next/image の最適化は任意の外部ドメインに使えず、使うと画像変換の従量課金も発生するため素の img を使う
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      style={style}
    />
  )
}

// ぼかした画像が startedAt から durationMs かけてはっきりしていく。stopped(0〜1) で止める。
export function VisualReveal({
  src,
  startedAt,
  stopped,
  durationMs = VISUAL_REVEAL_MS,
}: {
  src: string
  startedAt: number | null
  stopped: number | null
  durationMs?: number
}) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (stopped !== null || startedAt === null) return
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (performance.now() - startedAt) / durationMs)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, stopped, durationMs])

  const p = stopped ?? (startedAt === null ? 0 : progress)
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-2xl bg-gray-900/40">
      <QuizImage
        src={src}
        className="mx-auto max-h-[42vh] w-auto object-contain"
        style={{ filter: `blur(${(1 - p) * 28}px)`, transform: `scale(${1 + (1 - p) * 0.1})` }}
      />
      {stopped === null && p < 1 && (
        <div className="absolute bottom-2 left-2 right-2 h-1.5 overflow-hidden rounded-full bg-white/30">
          <div className="h-full bg-white" style={{ width: `${p * 100}%` }} />
        </div>
      )}
    </div>
  )
}
