'use client'

import { useState } from 'react'
import type { Memo, MemoType } from '@/types'

const TYPE_LABELS: Record<MemoType, string> = {
  quote: '📌 引用', thought: '💡 自分の考え', qa: '❓ 一問一答',
}
const BADGE_COLORS: Record<MemoType, string> = {
  quote: 'bg-yellow-100 text-yellow-800',
  thought: 'bg-green-100 text-green-800',
  qa: 'bg-violet-100 text-violet-800',
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export default function ReviewModal({ memos, onClose }: { memos: Memo[]; onClose: () => void }) {
  const [queue] = useState(() => shuffle(memos))
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const m = queue[idx]

  function next() {
    setRevealed(false)
    setIdx(i => (i + 1) % queue.length)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-7 relative shadow-2xl flex flex-col gap-4">
        <button onClick={onClose} className="absolute top-3 right-4 text-gray-300 hover:text-gray-500 text-lg">✕</button>

        <div className="text-xs text-gray-400">復習モード</div>

        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start ${BADGE_COLORS[m.type]}`}>
          {TYPE_LABELS[m.type]}
        </span>

        {m.type === 'qa' ? (
          <div>
            <p className="font-semibold text-base leading-relaxed">Q: {m.question}</p>
            {!revealed ? (
              <button onClick={() => setRevealed(true)} className="mt-3 text-sm text-blue-500 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50">
                答えを見る
              </button>
            ) : (
              <div className="mt-3 bg-green-50 rounded-lg px-3 py-2.5 text-sm leading-relaxed">
                A: {m.answer}
              </div>
            )}
          </div>
        ) : (
          <p className="text-base leading-relaxed whitespace-pre-wrap">{m.text}</p>
        )}

        {m.tags && m.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {m.tags.map(t => (
              <span key={t} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">#{t}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-300">{idx + 1} / {queue.length}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50">終了</button>
            <button onClick={next} className="text-xs bg-blue-500 text-white rounded px-3 py-1.5 hover:bg-blue-600">次へ →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
