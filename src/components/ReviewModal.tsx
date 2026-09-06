'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Memo } from '@/types'

// 正誤記録
type Result = 'correct' | 'wrong' | null

// 適応出題アルゴリズム：間違えた問題を優先的に再出題
function buildQueue(memos: Memo[]): Memo[] {
  return [...memos].sort(() => Math.random() - 0.5)
}

function buildAdaptiveQueue(memos: Memo[], results: Record<string, Result>): Memo[] {
  const wrong = memos.filter(m => results[m.id] === 'wrong')
  const unseen = memos.filter(m => results[m.id] === null || results[m.id] === undefined)
  const correct = memos.filter(m => results[m.id] === 'correct')
  // 間違い → 未回答 → 正解 の順で並べ、各グループ内はシャッフル
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5)
  return [...shuffle(wrong), ...shuffle(unseen), ...shuffle(correct)]
}

export default function ReviewModal({
  memos,
  tagLabel,
  onClose,
}: {
  memos: Memo[]
  tagLabel: string | null
  onClose: () => void
}) {
  const [queue, setQueue] = useState<Memo[]>(() => buildQueue(memos))
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [finished, setFinished] = useState(false)

  const m = queue[idx]

  const totalCount = memos.length
  const answeredCount = Object.keys(results).length
  const correctCount = Object.values(results).filter(r => r === 'correct').length
  const wrongCount = Object.values(results).filter(r => r === 'wrong').length

  function answer(result: 'correct' | 'wrong') {
    const newResults = { ...results, [m.id]: result }
    setResults(newResults)

    if (idx + 1 >= queue.length) {
      setFinished(true)
    } else {
      setRevealed(false)
      setIdx(i => i + 1)
    }
  }

  function restart(adaptiveMode: boolean) {
    const newQueue = adaptiveMode
      ? buildAdaptiveQueue(memos, results)
      : buildQueue(memos)
    setQueue(newQueue)
    setIdx(0)
    setRevealed(false)
    setFinished(false)
    if (!adaptiveMode) setResults({})
  }

  // キーボード操作
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (!revealed) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(true) }
    } else {
      if (e.key === 'ArrowRight' || e.key === 'l') answer('correct')
      if (e.key === 'ArrowLeft' || e.key === 'j') answer('wrong')
    }
  }, [revealed, m])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // 結果サマリー画面
  if (finished) {
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm p-8 flex flex-col gap-5">
          <div className="text-center">
            <div className="text-3xl font-bold mb-1">{accuracy}%</div>
            <div className="text-sm text-gray-400">正解率</div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border border-gray-200 p-3">
              <div className="text-xl font-semibold">{totalCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">出題数</div>
            </div>
            <div className="border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xl font-semibold text-emerald-700">{correctCount}</div>
              <div className="text-xs text-emerald-600 mt-0.5">正解</div>
            </div>
            <div className="border border-red-200 bg-red-50 p-3">
              <div className="text-xl font-semibold text-red-600">{wrongCount}</div>
              <div className="text-xs text-red-500 mt-0.5">不正解</div>
            </div>
          </div>

          {wrongCount > 0 && (
            <div className="border border-gray-100 p-3 bg-gray-50">
              <div className="text-xs font-semibold text-gray-500 mb-2">間違えた問題</div>
              <div className="flex flex-col gap-1.5">
                {queue.filter(q => results[q.id] === 'wrong').map(q => (
                  <div key={q.id} className="text-xs text-gray-700 border-l-2 border-red-300 pl-2">
                    {q.question}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {wrongCount > 0 && (
              <button
                onClick={() => restart(true)}
                className="w-full text-sm bg-gray-900 text-white py-2.5 hover:bg-gray-700 transition-colors"
              >
                間違えた問題を優先して再挑戦 ({wrongCount}問)
              </button>
            )}
            <button
              onClick={() => restart(false)}
              className="w-full text-sm border border-gray-200 py-2.5 hover:bg-gray-50 transition-colors"
            >
              最初からやり直す
            </button>
            <button
              onClick={onClose}
              className="w-full text-sm text-gray-400 py-2 hover:text-gray-600 transition-colors"
            >
              終了
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 問題画面
  const progressPercent = Math.round((answeredCount / totalCount) * 100)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500">復習</span>
            {tagLabel && (
              <span className="text-xs border border-gray-200 px-2 py-0.5 text-gray-500">{tagLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{idx + 1} / {queue.length}</span>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg leading-none">✕</button>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-gray-800 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* スコア */}
        <div className="flex gap-4 px-5 py-2 border-b border-gray-100 bg-gray-50">
          <span className="text-xs text-emerald-600">正解 {correctCount}</span>
          <span className="text-xs text-red-500">不正解 {wrongCount}</span>
          <span className="text-xs text-gray-400">未回答 {totalCount - answeredCount}</span>
        </div>

        {/* 問題本文 */}
        <div className="px-6 py-6 min-h-[160px] flex flex-col justify-center">
          <div className="text-xs text-gray-400 mb-3">Q.</div>
          <p className="text-base font-medium leading-relaxed">{m.question}</p>

          {m.tags && m.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-4">
              {m.tags.map(t => (
                <span key={t} className="text-xs border border-gray-200 px-2 py-0.5 text-gray-400">#{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* 答え */}
        {!revealed ? (
          <div className="px-6 pb-6">
            <button
              onClick={() => setRevealed(true)}
              className="w-full py-2.5 border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              答えを見る
              <span className="text-xs text-gray-300 ml-2">Space / Enter</span>
            </button>
          </div>
        ) : (
          <div className="px-6 pb-6 flex flex-col gap-3">
            <div className="border-t border-gray-200 pt-4">
              <div className="text-xs text-gray-400 mb-2">A.</div>
              <p className="text-sm leading-relaxed bg-gray-50 px-3 py-3">{m.answer}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => answer('wrong')}
                className="flex-1 py-3 border-2 border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                ✗ 不正解
                <span className="text-xs text-red-300 ml-1.5">← J</span>
              </button>
              <button
                onClick={() => answer('correct')}
                className="flex-1 py-3 border-2 border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors"
              >
                ○ 正解
                <span className="text-xs text-emerald-400 ml-1.5">L →</span>
              </button>
            </div>
          </div>
        )}

        {/* キーボードヒント */}
        <div className="px-6 pb-3 text-center text-xs text-gray-300">
          Esc で終了
        </div>
      </div>
    </div>
  )
}
