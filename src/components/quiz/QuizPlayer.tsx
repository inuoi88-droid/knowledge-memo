'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Quiz } from '@/types'
import { shuffle } from '@/lib/quiz'
import { btn } from '@/lib/ui'
import { DifficultyBadge } from './Difficulty'
import ProgressiveText from './ProgressiveText'

type Mode = 'normal' | 'buzzer'
type Result = 'correct' | 'wrong'

const COUNT_OPTIONS = [5, 10, 20, 0] as const
const CHAR_MS = 110

export default function QuizPlayer({
  quizzes,
  title,
  onClose,
}: {
  quizzes: Quiz[]
  title: string
  onClose: () => void
}) {
  const [screen, setScreen] = useState<'setup' | 'playing' | 'result'>('setup')
  const [mode, setMode] = useState<Mode>('normal')
  const [countOpt, setCountOpt] = useState<number>(quizzes.length > 10 ? 10 : 0)

  const [queue, setQueue] = useState<Quiz[]>([])
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [revealed, setRevealed] = useState(false)
  const [readStart, setReadStart] = useState<number | null>(null)
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)

  const current = queue[idx]

  const beginQuestion = useCallback((m: Mode) => {
    setRevealed(false)
    setStoppedAt(null)
    setReadStart(m === 'buzzer' ? performance.now() : null)
  }, [])

  function start(pool: Quiz[], useLimit = true) {
    const picked = shuffle(pool)
    const n = useLimit && countOpt > 0 ? Math.min(countOpt, picked.length) : picked.length
    setQueue(picked.slice(0, n))
    setIdx(0)
    setResults({})
    setScreen('playing')
    beginQuestion(mode)
  }

  const press = useCallback(() => {
    if (!current || readStart === null || stoppedAt !== null) return
    const n = Math.min(current.question.length, Math.floor((performance.now() - readStart) / CHAR_MS))
    setStoppedAt(n)
  }, [current, readStart, stoppedAt])

  const grade = useCallback((r: Result) => {
    if (!current) return
    setResults(prev => ({ ...prev, [current.id]: r }))
    if (idx + 1 >= queue.length) {
      setScreen('result')
    } else {
      setIdx(i => i + 1)
      beginQuestion(mode)
    }
  }, [current, idx, queue.length, mode, beginQuestion])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (screen !== 'playing') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (mode === 'buzzer' && stoppedAt === null && !revealed) press()
        else setRevealed(true)
        return
      }
      if (!revealed) return
      if (e.key === 'ArrowRight' || e.key === 'l') grade('correct')
      if (e.key === 'ArrowLeft' || e.key === 'j') grade('wrong')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, mode, stoppedAt, revealed, press, grade, onClose])

  const correctCount = Object.values(results).filter(r => r === 'correct').length
  const wrongQuizzes = queue.filter(q => results[q.id] === 'wrong')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">クイズ</div>
            <div className="truncate text-sm font-semibold text-gray-800">{title}</div>
          </div>
          <div className="flex items-center gap-3">
            {screen === 'playing' && (
              <span className="text-xs tabular-nums text-gray-400">{idx + 1} / {queue.length}</span>
            )}
            <button onClick={onClose} className="rounded-md p-1 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="閉じる">✕</button>
          </div>
        </div>

        {screen === 'setup' && (
          <div className="flex flex-col gap-5 overflow-y-auto p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{quizzes.length}<span className="ml-1 text-base font-medium text-gray-500">問</span></div>
              <div className="mt-1 text-xs text-gray-400">から出題します</div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-gray-500">問題数</div>
              <div className="grid grid-cols-4 gap-2">
                {COUNT_OPTIONS.filter(c => c === 0 || c < quizzes.length).map(c => (
                  <button key={c} onClick={() => setCountOpt(c)}
                    className={`rounded-lg border py-2 text-sm transition-colors ${countOpt === c ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {c === 0 ? `全部 (${quizzes.length})` : `${c}問`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-gray-500">モード</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode('normal')}
                  className={`rounded-lg border p-3 text-left transition-colors ${mode === 'normal' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-sm font-semibold">📝 ふつう</div>
                  <div className="mt-0.5 text-xs text-gray-500">問題文をすべて表示</div>
                </button>
                <button onClick={() => setMode('buzzer')}
                  className={`rounded-lg border p-3 text-left transition-colors ${mode === 'buzzer' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-sm font-semibold">⚡ 早押し練習</div>
                  <div className="mt-0.5 text-xs text-gray-500">問題文が少しずつ表示</div>
                </button>
              </div>
            </div>

            <button onClick={() => start(quizzes)} className={`${btn.primary} py-3 text-base`}>スタート</button>
          </div>
        )}

        {screen === 'playing' && current && (
          <>
            <div className="h-1 bg-gray-100">
              <div className="h-1 bg-indigo-500 transition-all duration-300" style={{ width: `${(idx / queue.length) * 100}%` }} />
            </div>

            <div className="flex min-h-[220px] flex-col gap-4 overflow-y-auto px-6 py-6">
              <DifficultyBadge level={current.difficulty} showLabel />
              <div className="flex gap-2 text-lg leading-relaxed">
                <span className="font-bold text-indigo-600">Q.</span>
                {mode === 'buzzer' ? (
                  <ProgressiveText
                    key={`${current.id}-${idx}`}
                    text={current.question}
                    startedAt={readStart}
                    charMs={CHAR_MS}
                    stopped={revealed && stoppedAt === null ? current.question.length : stoppedAt}
                    className="flex-1 font-medium"
                  />
                ) : (
                  <p className="flex-1 font-medium">{current.question}</p>
                )}
              </div>

              {mode === 'buzzer' && stoppedAt !== null && !revealed && (
                <p className="text-center text-sm font-semibold text-rose-600">
                  {stoppedAt >= current.question.length ? '最後まで読まれました' : `${stoppedAt}文字目で押しました！`}
                </p>
              )}

              {revealed && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex gap-2 text-lg">
                    <span className="font-bold text-emerald-600">A.</span>
                    <span className="font-semibold text-gray-900">{current.answer}</span>
                  </div>
                  {current.explanation && (
                    <p className="mt-2 whitespace-pre-wrap border-t border-emerald-100 pt-2 text-sm leading-relaxed text-gray-700">
                      <span className="mr-1 font-semibold text-amber-700">解説</span>
                      {current.explanation}
                    </p>
                  )}
                  {mode === 'buzzer' && stoppedAt !== null && stoppedAt < current.question.length && (
                    <p className="mt-2 text-xs text-gray-500">全文: {current.question}</p>
                  )}
                  {current.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {current.tags.map(t => <span key={t} className="text-xs text-indigo-600">#{t}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 p-4">
              {!revealed ? (
                mode === 'buzzer' && stoppedAt === null ? (
                  <button onClick={press} className="w-full rounded-xl bg-rose-500 py-4 text-lg font-bold text-white shadow-md transition-transform hover:bg-rose-600 active:scale-[0.98]">
                    押す！ <span className="ml-1 text-xs font-normal opacity-80">Space</span>
                  </button>
                ) : (
                  <button onClick={() => setRevealed(true)} className={`${btn.secondary} w-full py-3`}>
                    答えを見る <span className="text-xs text-gray-400">Space</span>
                  </button>
                )
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => grade('wrong')} className="rounded-xl border-2 border-rose-200 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50">
                    ✗ 不正解 <span className="text-xs font-normal text-rose-300">← J</span>
                  </button>
                  <button onClick={() => grade('correct')} className="rounded-xl border-2 border-emerald-300 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50">
                    ○ 正解 <span className="text-xs font-normal text-emerald-400">L →</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {screen === 'result' && (
          <div className="flex flex-col gap-5 overflow-y-auto p-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900">
                {queue.length > 0 ? Math.round((correctCount / queue.length) * 100) : 0}
                <span className="text-2xl">%</span>
              </div>
              <div className="mt-1 text-sm text-gray-500">{queue.length}問中 {correctCount}問正解</div>
            </div>

            {wrongQuizzes.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 text-xs font-semibold text-gray-500">間違えた問題</div>
                <ul className="flex flex-col gap-1.5">
                  {wrongQuizzes.map(q => (
                    <li key={q.id} className="border-l-2 border-rose-300 pl-2 text-sm">
                      <span className="text-gray-700">{q.question}</span>
                      <span className="ml-2 font-semibold text-emerald-700">→ {q.answer}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {wrongQuizzes.length > 0 && (
                <button onClick={() => start(wrongQuizzes, false)} className={`${btn.primary} py-2.5`}>
                  間違えた問題だけ再挑戦 ({wrongQuizzes.length}問)
                </button>
              )}
              <button onClick={() => setScreen('setup')} className={`${btn.secondary} py-2.5`}>もう一度遊ぶ</button>
              <button onClick={onClose} className="py-2 text-sm text-gray-400 hover:text-gray-600">終了</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
