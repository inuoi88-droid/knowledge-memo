'use client'

import { useState, type CSSProperties } from 'react'

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
