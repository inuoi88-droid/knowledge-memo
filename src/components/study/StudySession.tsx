'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Quiz } from '@/types'
import { buildChoices, isCorrectAnswer } from '@/lib/quiz'
import { recordAnswer, recordSession } from '@/lib/progress'
import { setMuted, sfx, useMuted } from '@/lib/sound'
import { CHOICE_LABELS, CHOICE_STYLES, STAGE_BG } from '@/lib/stage'
import { DifficultyBadge } from '@/components/quiz/Difficulty'
import AnswerSearchLink from '@/components/quiz/AnswerSearchLink'
import { QuizImage } from '@/components/quiz/QuizImage'

export type StudyKind = 'learn' | 'check' | 'review'

export const STUDY_KINDS: Record<StudyKind, { icon: string; name: string; desc: string }> = {
  learn: { icon: '📖', name: '覚える', desc: 'カードをめくって答えと解説を覚える' },
  check: { icon: '🧪', name: '確かめる', desc: '四択で正解したら、次は入力でテスト' },
  review: { icon: '🔁', name: '復習', desc: '忘れかけた頃の問題を思い出す' },
}

export interface StudyItem {
  quiz: Quiz
  stage: 'card' | 'choice' | 'typing'
  choices: string[] | null
  tries: number
}

// 同じ問題は3回までくり返し出す（それでもダメなら「もう少し」として次回へ）
const MAX_TRIES = 3

export function buildStudyQueue(kind: StudyKind, quizzes: readonly Quiz[], pool: readonly Quiz[]): StudyItem[] {
  return quizzes.map(quiz =>
    kind === 'check'
      ? { quiz, stage: 'choice' as const, choices: buildChoices(quiz, pool), tries: 0 }
      : { quiz, stage: 'card' as const, choices: null, tries: 0 },
  )
}

type Outcome = 'correct' | 'wrong'

export default function StudySession({
  kind,
  title,
  initialQueue,
  pool,
  startedAt,
  onClose,
}: {
  kind: StudyKind
  title: string
  initialQueue: StudyItem[]
  pool: Quiz[]
  startedAt: number
  onClose: () => void
}) {
  const muted = useMuted()
  const [queue, setQueue] = useState(initialQueue)
  const [total, setTotal] = useState(initialQueue.length)
  const [phase, setPhase] = useState<'asking' | 'revealed'>('asking')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [cleared, setCleared] = useState(0)
  const [givenUp, setGivenUp] = useState(0)
  const [attempts, setAttempts] = useState({ correct: 0, total: 0 })
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [runStart, setRunStart] = useState(startedAt)

  const pendingRef = useRef<{ memoId: string; correct: boolean } | null>(null)
  const flushPending = useCallback(() => {
    const p = pendingRef.current
    pendingRef.current = null
    if (p) recordAnswer(p.memoId, p.correct)
  }, [])
  useEffect(() => () => flushPending(), [flushPending])

  const item = queue[0]
  const done = finishedAt !== null
  const info = STUDY_KINDS[kind]

  function answer(result: Outcome, pick?: string) {
    if (!item || phase !== 'asking') return
    flushPending()
    pendingRef.current = { memoId: item.quiz.id, correct: result === 'correct' }
    setAttempts(a => ({ correct: a.correct + (result === 'correct' ? 1 : 0), total: a.total + 1 }))
    setOutcome(result)
    setPicked(pick ?? null)
    setPhase('revealed')
    if (result === 'correct') sfx.correct()
    else sfx.wrong()
  }

  function advance() {
    if (!item || !outcome) return
    flushPending()
    const [cur, ...rest] = queue
    let nextQueue = rest
    if (outcome === 'correct') {
      if (cur.stage === 'choice') nextQueue = [...rest, { ...cur, stage: 'typing', choices: null }]
      else setCleared(c => c + 1)
    } else if (cur.tries + 1 < MAX_TRIES) {
      const retry: StudyItem = cur.stage === 'card'
        ? { ...cur, tries: cur.tries + 1 }
        : { ...cur, stage: 'choice', choices: buildChoices(cur.quiz, pool), tries: cur.tries + 1 }
      nextQueue = [...rest, retry]
    } else {
      setGivenUp(g => g + 1)
    }
    setQueue(nextQueue)
    setPhase('asking')
    setOutcome(null)
    setPicked(null)
    setTyped('')
    if (nextQueue.length === 0) {
      setFinishedAt(performance.now())
      sfx.fanfare()
    }
  }

  // カードは「覚えた／まだ」を押したらそのまま次へ
  function gradeCard(result: Outcome) {
    if (!item || item.stage !== 'card' || phase !== 'revealed' || outcome) return
    flushPending()
    recordAnswer(item.quiz.id, result === 'correct')
    setAttempts(a => ({ correct: a.correct + (result === 'correct' ? 1 : 0), total: a.total + 1 }))
    const [cur, ...rest] = queue
    let nextQueue = rest
    if (result === 'correct') setCleared(c => c + 1)
    else if (cur.tries + 1 < MAX_TRIES) nextQueue = [...rest, { ...cur, tries: cur.tries + 1 }]
    else setGivenUp(g => g + 1)
    setQueue(nextQueue)
    setPhase('asking')
    if (result === 'correct') sfx.correct()
    else sfx.tap()
    if (nextQueue.length === 0) {
      setFinishedAt(performance.now())
      sfx.fanfare()
    }
  }

  function overrideCorrect() {
    if (outcome !== 'wrong') return
    if (pendingRef.current) pendingRef.current = { ...pendingRef.current, correct: true }
    setAttempts(a => ({ ...a, correct: a.correct + 1 }))
    setOutcome('correct')
    sfx.correct()
  }

  function restart() {
    const quizzes = [...new Map(initialQueue.map(i => [i.quiz.id, i.quiz])).values()]
    const q = buildStudyQueue(kind, quizzes, pool)
    setQueue(q)
    setTotal(q.length)
    setPhase('asking')
    setOutcome(null)
    setPicked(null)
    setTyped('')
    setCleared(0)
    setGivenUp(0)
    setAttempts({ correct: 0, total: 0 })
    setFinishedAt(null)
    setRunStart(performance.now())
  }

  // 終わったら今回の勉強をプレイ記録に残す
  const savedRef = useRef<number | null>(null)
  useEffect(() => {
    if (finishedAt === null || attempts.total === 0 || savedRef.current === runStart) return
    savedRef.current = runStart
    recordSession({
      title: `${info.name}：${title}`,
      mode: `study-${kind}`,
      rule: 'study',
      total: attempts.total,
      correct: attempts.correct,
      maxCombo: 0,
      durationMs: finishedAt - runStart,
    })
  }, [finishedAt, attempts, runStart, info.name, title, kind])

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (!item || done) return
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      if (item.stage === 'card') {
        if (phase === 'asking' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setPhase('revealed') }
        else if (phase === 'revealed') {
          if (e.key === 'ArrowRight' || e.key === 'l') gradeCard('correct')
          if (e.key === 'ArrowLeft' || e.key === 'j') gradeCard('wrong')
        }
        return
      }
      if (phase === 'asking' && item.stage === 'choice' && item.choices && /^[1-4]$/.test(e.key)) {
        const c = item.choices[Number(e.key) - 1]
        if (c !== undefined) answer(c === item.quiz.answer ? 'correct' : 'wrong', c)
      } else if (phase === 'revealed' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        advance()
      }
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const quiz = item?.quiz
  const progressDone = cleared + givenUp

  return (
    <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto ${STAGE_BG} text-white`}>
      <header className="sticky top-0 z-10 bg-[#1e1b4b]/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-widest text-indigo-200">{info.icon} 勉強モード ・ {info.name}</div>
            <div className="truncate text-sm font-bold">{title}</div>
          </div>
          {!done && (
            <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
              <span className="rounded-full bg-emerald-500/80 px-2.5 py-0.5">✓ {cleared}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">残り {queue.length}</span>
            </div>
          )}
          <button onClick={() => setMuted(!muted)} className="rounded-full p-2 text-lg hover:bg-white/10" title={muted ? '音を出す' : 'ミュート'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button onClick={onClose} className="rounded-full p-2 text-lg leading-none hover:bg-white/10" aria-label="閉じる">✕</button>
        </div>
        {!done && (
          <div className="h-1 bg-white/10">
            <div className="h-1 bg-gradient-to-r from-emerald-300 to-sky-400 transition-all duration-300" style={{ width: `${(progressDone / Math.max(1, total)) * 100}%` }} />
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        {!done && item && quiz && (
          <>
            <div key={`${quiz.id}-${item.stage}-${item.tries}`} className="animate-slide-up rounded-3xl bg-white p-5 text-gray-900 shadow-2xl sm:p-7">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-black text-white">
                  {item.stage === 'card' ? '📖 カード' : item.stage === 'choice' ? '🔢 四択' : '⌨️ 入力'}
                  {item.tries > 0 && ' ・ もう一度'}
                </span>
                <DifficultyBadge level={quiz.difficulty} showLabel />
              </div>
              {quiz.image_url && <QuizImage src={quiz.image_url} className="mx-auto mb-4 max-h-60 rounded-xl object-contain" />}
              <p className="whitespace-pre-wrap text-xl font-bold leading-relaxed sm:text-2xl">{quiz.question}</p>
            </div>

            {item.stage === 'card' && phase === 'asking' && (
              <button onClick={() => setPhase('revealed')} className="w-full rounded-3xl bg-white/15 py-4 text-lg font-bold ring-1 ring-white/30 hover:bg-white/25">
                答えを見る <span className="text-xs font-normal opacity-70">Space</span>
              </button>
            )}

            {item.stage === 'choice' && phase === 'asking' && item.choices && (
              <div className="grid gap-2 sm:grid-cols-2">
                {item.choices.map((c, i) => (
                  <button
                    key={c}
                    onClick={() => answer(c === quiz.answer ? 'correct' : 'wrong', c)}
                    className={`${CHOICE_STYLES[i]} flex items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-bold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25 text-sm font-black">{CHOICE_LABELS[i]}</span>
                    <span className="min-w-0 break-words">{c}</span>
                  </button>
                ))}
              </div>
            )}

            {item.stage === 'typing' && phase === 'asking' && (
              <form onSubmit={e => { e.preventDefault(); if (typed.trim()) answer(isCorrectAnswer(typed, quiz.answer) ? 'correct' : 'wrong', typed.trim()) }} className="flex gap-2">
                <input
                  autoFocus
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}
                  placeholder="四択で正解！今度は答えを入力"
                  className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-4 text-lg font-bold text-gray-900 shadow-lg outline-none ring-indigo-400 focus:ring-4"
                />
                <button type="submit" disabled={!typed.trim()} className="rounded-2xl bg-emerald-500 px-5 font-black shadow-lg disabled:opacity-40">回答</button>
              </form>
            )}

            {phase === 'revealed' && (
              <div className={`rounded-3xl p-5 text-gray-900 shadow-xl ${outcome === 'wrong' ? 'animate-shake bg-rose-50' : outcome === 'correct' ? 'animate-pop-in bg-emerald-50' : 'animate-pop-in bg-white'}`}>
                {outcome && (
                  <div className={`mb-2 text-lg font-black ${outcome === 'correct' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {outcome === 'correct'
                      ? item.stage === 'choice' ? '⭕ 正解！ あとで入力でも確かめます' : '⭕ 正解！ クリア'
                      : '✗ ざんねん… あとでもう一度'}
                    {outcome === 'wrong' && picked && <span className="ml-2 text-sm font-medium text-gray-500">あなたの答え: {picked}</span>}
                  </div>
                )}
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-lg font-black text-emerald-600">A.</span>
                  <span className="text-2xl font-black">{quiz.answer}</span>
                  <AnswerSearchLink answer={quiz.answer} className="ml-auto self-center" />
                </div>
                {quiz.explanation && (
                  <p className="mt-2 whitespace-pre-wrap border-t border-black/5 pt-2 text-sm leading-relaxed text-gray-700">
                    <span className="mr-1 font-bold text-amber-700">解説</span>{quiz.explanation}
                  </p>
                )}
                {quiz.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quiz.tags.map(t => <span key={t} className="text-xs text-indigo-600">#{t}</span>)}
                  </div>
                )}
              </div>
            )}

            {phase === 'revealed' && item.stage === 'card' && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => gradeCard('wrong')} className="rounded-2xl bg-white/15 py-4 text-lg font-black ring-1 ring-white/30 active:scale-95">
                  ✗ まだ <span className="text-xs font-normal opacity-70">← J</span>
                </button>
                <button onClick={() => gradeCard('correct')} className="rounded-2xl bg-emerald-500 py-4 text-lg font-black shadow-lg active:scale-95">
                  ✓ 覚えた <span className="text-xs font-normal opacity-80">L →</span>
                </button>
              </div>
            )}

            {phase === 'revealed' && item.stage !== 'card' && (
              <div className="flex gap-2">
                {item.stage === 'typing' && outcome === 'wrong' && (
                  <button onClick={overrideCorrect} className="rounded-2xl bg-white/15 px-4 py-4 text-sm font-bold ring-1 ring-white/30 hover:bg-white/25">
                    実は合ってた
                  </button>
                )}
                <button onClick={advance} className="flex-1 rounded-2xl bg-white py-4 text-lg font-black text-indigo-900 shadow-lg active:scale-[0.98]">
                  次へ → <span className="text-xs font-normal text-gray-400">Enter</span>
                </button>
              </div>
            )}
          </>
        )}

        {done && (
          <div className="animate-pop-in flex flex-col gap-4 rounded-3xl bg-white p-6 text-center text-gray-900 shadow-2xl">
            <div className="text-4xl">📚</div>
            <div className="text-2xl font-black">おつかれさま！</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <div className="text-3xl font-black text-emerald-600">{cleared}</div>
                <div className="text-xs text-gray-500">{kind === 'check' ? 'クリア' : '覚えた'}</div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3">
                <div className="text-3xl font-black text-amber-600">{givenUp}</div>
                <div className="text-xs text-gray-500">もう少し</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-3">
                <div className="text-3xl font-black text-indigo-600">{attempts.total > 0 ? Math.round((attempts.correct / attempts.total) * 100) : 0}%</div>
                <div className="text-xs text-gray-500">正答率</div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              記録しました。覚えた問題は、忘れかけた頃に「🔁 今日の復習」に出てきます。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={restart} className="rounded-2xl border-2 border-indigo-100 py-3 font-bold text-indigo-700 hover:bg-indigo-50">もう一度</button>
              <button onClick={onClose} className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-black text-white">終わる</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
