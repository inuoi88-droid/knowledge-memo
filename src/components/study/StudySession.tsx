'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Quiz } from '@/types'
import { isCorrectAnswer } from '@/lib/quiz'
import { formatDays, recordAnswer, recordSession, type StudySettings } from '@/lib/progress'
import { setMuted, sfx, useMuted } from '@/lib/sound'
import { STAGE_BG, perfNow } from '@/lib/stage'
import { DifficultyBadge } from '@/components/quiz/Difficulty'
import AnswerSearchLink from '@/components/quiz/AnswerSearchLink'
import { QuizImage } from '@/components/quiz/QuizImage'

export type StudyStep = 'review' | 'learn' | 'check'

export const STUDY_STEPS: Record<StudyStep, { icon: string; name: string; desc: string }> = {
  review: { icon: '🔁', name: '復習', desc: '前に覚えた問題を思い出す' },
  learn: { icon: '📖', name: '覚える', desc: '新しい問題の答えを見て覚える' },
  check: { icon: '✍️', name: '書いて確かめる', desc: '答えを何回か書いて身につける' },
}
const STEP_ORDER: StudyStep[] = ['review', 'learn', 'check']

interface StudyItem {
  quiz: Quiz
  step: StudyStep
  // check：合格までにあと何回正しく書くか
  remaining: number
  tries: number
  // 今日はじめて覚える問題か（復習でまちがえて書き直す問題は false）
  fresh: boolean
}

// 新しい問題は5問ずつ「カードで覚える → 書いて確かめる」をくり返す
const CHUNK = 5
// やり直しの問題がすぐ続けて出ないよう、残りがこれより少なくなったら次の5問を足す
const MIN_QUEUE = 3
// 同じ問題は3巡までくり返し出す（それでもダメなら「もう少し」として次回へ）
const MAX_TRIES = 3

function chunkItems(quizzes: readonly Quiz[], repeats: number): StudyItem[] {
  return [
    ...quizzes.map(quiz => ({ quiz, step: 'learn' as const, remaining: 0, tries: 0, fresh: true })),
    ...quizzes.map(quiz => ({ quiz, step: 'check' as const, remaining: repeats, tries: 0, fresh: true })),
  ]
}

interface Plan { queue: StudyItem[]; backlog: Quiz[] }

// 今の山が残り少なくなったら、次の新しい問題を5問足す
function refill(queue: StudyItem[], backlog: Quiz[], repeats: number): Plan {
  if (queue.length >= MIN_QUEUE || backlog.length === 0) return { queue, backlog }
  return { queue: [...queue, ...chunkItems(backlog.slice(0, CHUNK), repeats)], backlog: backlog.slice(CHUNK) }
}

type Outcome = 'correct' | 'wrong'

export default function StudySession({
  title,
  reviews,
  fresh,
  settings,
  onClose,
  more,
}: {
  title: string
  reviews: Quiz[]
  fresh: Quiz[]
  settings: StudySettings
  onClose: () => void
  more?: { label: string; onStart: () => void }
}) {
  const muted = useMuted()
  const repeats = settings.checkRepeats
  const [plan, setPlan] = useState<Plan>(() =>
    refill(reviews.map(quiz => ({ quiz, step: 'review', remaining: 1, tries: 0, fresh: false })), [...fresh], repeats),
  )
  const total = reviews.length + fresh.length
  const [phase, setPhase] = useState<'asking' | 'revealed'>('asking')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [given, setGiven] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [stats, setStats] = useState({ reviewOk: 0, reviewMissed: 0, learned: 0, relearned: 0, givenUp: 0 })
  const [attempts, setAttempts] = useState({ correct: 0, total: 0 })
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [startedAt] = useState(perfNow)

  // 入力の回答は「次へ」で確定して保存する（「実は合ってた」を反映するため）
  const pendingRef = useRef<{ memoId: string; correct: boolean } | null>(null)
  const flushPending = useCallback(() => {
    const p = pendingRef.current
    pendingRef.current = null
    if (p) recordAnswer(p.memoId, p.correct, true)
  }, [])
  useEffect(() => () => flushPending(), [flushPending])

  const item = plan.queue[0]
  const done = finishedAt !== null
  const typing = item && (item.step === 'check' || (item.step === 'review' && settings.reviewStyle === 'typing'))
  const finishedCount = stats.reviewOk + stats.learned + stats.relearned + stats.givenUp

  function moveOn(nextQueue: StudyItem[]) {
    const next = refill(nextQueue, plan.backlog, repeats)
    setPlan(next)
    setPhase('asking')
    setOutcome(null)
    setGiven(null)
    setTyped('')
    if (next.queue.length === 0) {
      setFinishedAt(perfNow())
      sfx.fanfare()
    }
  }

  function bump(key: keyof typeof stats) {
    setStats(s => ({ ...s, [key]: s[key] + 1 }))
  }

  function submitTyped() {
    if (!item || phase !== 'asking' || !typed.trim()) return
    const result: Outcome = isCorrectAnswer(typed, item.quiz.answer) ? 'correct' : 'wrong'
    flushPending()
    pendingRef.current = { memoId: item.quiz.id, correct: result === 'correct' }
    setAttempts(a => ({ correct: a.correct + (result === 'correct' ? 1 : 0), total: a.total + 1 }))
    setOutcome(result)
    setGiven(typed.trim())
    setPhase('revealed')
    if (result === 'correct') sfx.correct()
    else sfx.wrong()
  }

  function overrideCorrect() {
    if (outcome !== 'wrong') return
    if (pendingRef.current) pendingRef.current = { ...pendingRef.current, correct: true }
    setAttempts(a => ({ ...a, correct: a.correct + 1 }))
    setOutcome('correct')
    sfx.correct()
  }

  // 書いて答えたあと：正解なら残り回数を減らして後ろへ、まちがいなら書き直し
  function advanceTyping() {
    if (!item || !outcome) return
    flushPending()
    const [cur, ...rest] = plan.queue
    let nextQueue = rest
    if (cur.step === 'review') {
      if (outcome === 'correct') bump('reviewOk')
      else {
        bump('reviewMissed')
        nextQueue = [...rest, { ...cur, step: 'check', remaining: repeats, tries: 1 }]
      }
    } else if (outcome === 'correct') {
      if (cur.remaining > 1) nextQueue = [...rest, { ...cur, remaining: cur.remaining - 1 }]
      else bump(cur.fresh ? 'learned' : 'relearned')
    } else if (cur.tries + 1 < MAX_TRIES) {
      nextQueue = [...rest, { ...cur, remaining: repeats, tries: cur.tries + 1 }]
    } else {
      bump('givenUp')
    }
    moveOn(nextQueue)
  }

  // めくって自己採点する復習
  function gradeCard(result: Outcome) {
    if (!item || item.step !== 'review' || phase !== 'revealed') return
    recordAnswer(item.quiz.id, result === 'correct', true)
    setAttempts(a => ({ correct: a.correct + (result === 'correct' ? 1 : 0), total: a.total + 1 }))
    const [cur, ...rest] = plan.queue
    let nextQueue = rest
    if (result === 'correct') bump(cur.tries > 0 ? 'relearned' : 'reviewOk')
    else {
      if (cur.tries === 0) bump('reviewMissed')
      if (cur.tries + 1 < MAX_TRIES) nextQueue = [...rest, { ...cur, tries: cur.tries + 1 }]
      else bump('givenUp')
    }
    if (result === 'correct') sfx.correct()
    else sfx.tap()
    moveOn(nextQueue)
  }

  function nextLearn() {
    if (!item || item.step !== 'learn') return
    sfx.tap()
    moveOn(plan.queue.slice(1))
  }

  // 途中で閉じても、そこまでの学習を記録に残す
  const savedRef = useRef(false)
  const saveSession = useCallback((endAt: number) => {
    if (savedRef.current || attempts.total === 0) return
    savedRef.current = true
    recordSession({
      title: `学習：${title}`,
      mode: 'study',
      rule: 'study',
      total: attempts.total,
      correct: attempts.correct,
      maxCombo: 0,
      durationMs: endAt - startedAt,
    })
  }, [attempts, title, startedAt])
  useEffect(() => {
    if (finishedAt !== null) saveSession(finishedAt)
  }, [finishedAt, saveSession])

  const close = useCallback(() => {
    flushPending()
    saveSession(perfNow())
    onClose()
  }, [flushPending, saveSession, onClose])

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (!item || done) return
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      if (item.step === 'learn') {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); nextLearn() }
      } else if (!typing) {
        if (phase === 'asking' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setPhase('revealed') }
        else if (phase === 'revealed') {
          if (e.key === 'ArrowRight' || e.key === 'l') gradeCard('correct')
          if (e.key === 'ArrowLeft' || e.key === 'j') gradeCard('wrong')
        }
      } else if (phase === 'revealed' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        advanceTyping()
      }
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const quiz = item?.quiz
  const showAnswer = item?.step === 'learn' || phase === 'revealed'
  const timesDone = item ? repeats - item.remaining : 0
  const stepIndex = item ? STEP_ORDER.indexOf(item.step) : -1
  const usedSteps = STEP_ORDER.filter(s => (s === 'review' ? reviews.length > 0 : fresh.length > 0 || (s === 'check' && stats.reviewMissed > 0)))

  return (
    <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto ${STAGE_BG} text-white`}>
      <header className="sticky top-0 z-10 bg-[#1e1b4b]/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-widest text-indigo-200">📖 今日の学習</div>
            <div className="truncate text-sm font-bold">{title}</div>
          </div>
          {!done && (
            <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
              <span className="rounded-full bg-emerald-500/80 px-2.5 py-0.5">✓ {finishedCount}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">残り {total - finishedCount}問</span>
            </div>
          )}
          <button onClick={() => setMuted(!muted)} className="rounded-full p-2 text-lg hover:bg-white/10" title={muted ? '音を出す' : 'ミュート'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button onClick={close} className="rounded-full p-2 text-lg leading-none hover:bg-white/10" aria-label="閉じる">✕</button>
        </div>
        {!done && (
          <>
            <div className="h-1 bg-white/10">
              <div className="h-1 bg-gradient-to-r from-emerald-300 to-sky-400 transition-all duration-300" style={{ width: `${(finishedCount / Math.max(1, total)) * 100}%` }} />
            </div>
            <div className="mx-auto flex max-w-3xl items-center justify-center gap-1.5 px-4 py-2 text-[11px] font-bold">
              {usedSteps.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-white/30">→</span>}
                  <span className={`rounded-full px-2.5 py-0.5 ${STEP_ORDER.indexOf(s) === stepIndex ? 'bg-white text-indigo-900' : 'bg-white/10 text-white/60'}`}>
                    {STUDY_STEPS[s].icon} {STUDY_STEPS[s].name}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        {!done && item && quiz && (
          <>
            <div key={`${quiz.id}-${item.step}-${item.remaining}-${item.tries}`} className="animate-slide-up rounded-3xl bg-white p-5 text-gray-900 shadow-2xl sm:p-7">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-black text-white">
                    {item.step === 'learn' ? '📖 覚える' : item.step === 'review' ? `🔁 復習${typing ? '' : '（めくる）'}` : '✍️ 書いて確かめる'}
                    {item.tries > 0 && ' ・ やり直し'}
                  </span>
                  {item.step === 'learn' && <span className="text-xs font-bold text-amber-600">NEW</span>}
                  {item.step === 'check' && repeats > 1 && (
                    <span className="flex items-center gap-1" title={`${repeats}回正しく書けたら合格`}>
                      {Array.from({ length: repeats }, (_, i) => (
                        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < timesDone ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      ))}
                      <span className="ml-1 text-xs text-gray-500">あと{item.remaining}回</span>
                    </span>
                  )}
                </div>
                <DifficultyBadge level={quiz.difficulty} showLabel />
              </div>
              {quiz.image_url && <QuizImage src={quiz.image_url} className="mx-auto mb-4 max-h-60 rounded-xl object-contain" />}
              <p className="whitespace-pre-wrap text-xl font-bold leading-relaxed sm:text-2xl">{quiz.question}</p>
              {item.step === 'learn' && (
                <p className="mt-3 text-xs text-gray-400">答えを覚えたら次へ。このあと何問かはさんで、書いて確かめます。</p>
              )}
            </div>

            {!typing && item.step === 'review' && phase === 'asking' && (
              <button onClick={() => setPhase('revealed')} className="w-full rounded-3xl bg-white/15 py-4 text-lg font-bold ring-1 ring-white/30 hover:bg-white/25">
                答えを見る <span className="text-xs font-normal opacity-70">Space</span>
              </button>
            )}

            {typing && phase === 'asking' && (
              <form onSubmit={e => { e.preventDefault(); submitTyped() }} className="flex gap-2">
                <input
                  autoFocus
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}
                  placeholder="答えを書いて Enter"
                  className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-4 text-lg font-bold text-gray-900 shadow-lg outline-none ring-indigo-400 focus:ring-4"
                />
                <button type="submit" disabled={!typed.trim()} className="rounded-2xl bg-emerald-500 px-5 font-black shadow-lg disabled:opacity-40">回答</button>
              </form>
            )}

            {showAnswer && (
              <div className={`rounded-3xl p-5 text-gray-900 shadow-xl ${outcome === 'wrong' ? 'animate-shake bg-rose-50' : outcome === 'correct' ? 'animate-pop-in bg-emerald-50' : 'animate-pop-in bg-white'}`}>
                {outcome && (
                  <div className={`mb-2 text-lg font-black ${outcome === 'correct' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {outcome === 'correct'
                      ? item.step === 'check' && item.remaining > 1 ? `⭕ 正解！ あと${item.remaining - 1}回書いて合格` : '⭕ 正解！'
                      : item.step === 'review'
                        ? `✗ ざんねん… 書いて覚え直そう（${repeats}回）`
                        : item.tries + 1 < MAX_TRIES ? '✗ ざんねん… あとでもう一度' : '✗ ざんねん… また次回'}
                    {outcome === 'wrong' && given && <span className="ml-2 text-sm font-medium text-gray-500">あなたの答え: {given}</span>}
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

            {item.step === 'learn' && (
              <button onClick={nextLearn} className="w-full rounded-2xl bg-white py-4 text-lg font-black text-indigo-900 shadow-lg active:scale-[0.98]">
                覚えた！ 次へ → <span className="text-xs font-normal text-gray-400">Enter</span>
              </button>
            )}

            {!typing && item.step === 'review' && phase === 'revealed' && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => gradeCard('wrong')} className="rounded-2xl bg-white/15 py-4 text-lg font-black ring-1 ring-white/30 active:scale-95">
                  ✗ 忘れてた <span className="text-xs font-normal opacity-70">← J</span>
                </button>
                <button onClick={() => gradeCard('correct')} className="rounded-2xl bg-emerald-500 py-4 text-lg font-black shadow-lg active:scale-95">
                  ✓ 覚えてた <span className="text-xs font-normal opacity-80">L →</span>
                </button>
              </div>
            )}

            {typing && phase === 'revealed' && (
              <div className="flex gap-2">
                {outcome === 'wrong' && (
                  <button onClick={overrideCorrect} className="rounded-2xl bg-white/15 px-4 py-4 text-sm font-bold ring-1 ring-white/30 hover:bg-white/25">
                    実は合ってた
                  </button>
                )}
                <button onClick={advanceTyping} className="flex-1 rounded-2xl bg-white py-4 text-lg font-black text-indigo-900 shadow-lg active:scale-[0.98]">
                  次へ → <span className="text-xs font-normal text-gray-400">Enter</span>
                </button>
              </div>
            )}
          </>
        )}

        {done && (
          <div className="animate-pop-in flex flex-col gap-4 rounded-3xl bg-white p-6 text-center text-gray-900 shadow-2xl">
            <div className="text-4xl">🎉</div>
            <div className="text-2xl font-black">おつかれさま！</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {reviews.length > 0 && (
                <div className="rounded-2xl bg-sky-50 p-3">
                  <div className="text-3xl font-black text-sky-600">{stats.reviewOk}<span className="text-base text-gray-400">/{reviews.length}</span></div>
                  <div className="text-xs text-gray-500">復習で覚えてた</div>
                </div>
              )}
              {fresh.length > 0 && (
                <div className="rounded-2xl bg-emerald-50 p-3">
                  <div className="text-3xl font-black text-emerald-600">{stats.learned}</div>
                  <div className="text-xs text-gray-500">新しく覚えた</div>
                </div>
              )}
              <div className="rounded-2xl bg-amber-50 p-3">
                <div className="text-3xl font-black text-amber-600">{stats.givenUp}</div>
                <div className="text-xs text-gray-500">もう少し</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-3">
                <div className="text-3xl font-black text-indigo-600">{attempts.total > 0 ? Math.round((attempts.correct / attempts.total) * 100) : 0}%</div>
                <div className="text-xs text-gray-500">正答率</div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              記録しました。覚えた問題は {formatDays(settings.reviewDays[0])}後から、間隔をあけて復習に出てきます。
              {stats.givenUp > 0 && '「もう少し」の問題は、少し時間をおいてまた復習に出ます。'}
            </p>
            <div className={`grid gap-2 ${more ? 'sm:grid-cols-2' : ''}`}>
              {more && (
                <button onClick={more.onStart} className="rounded-2xl border-2 border-indigo-100 py-3 font-bold text-indigo-700 hover:bg-indigo-50">{more.label}</button>
              )}
              <button onClick={close} className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-black text-white">終わる</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
