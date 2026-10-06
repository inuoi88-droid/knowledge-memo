'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Quiz } from '@/types'
import { isCorrectAnswer } from '@/lib/quiz'
import { recordAnswer, recordSession } from '@/lib/progress'
import { CHOICE_LABELS, CHOICE_STYLES, STAGE_BG } from '@/lib/stage'
import {
  DEFAULT_CONFIG, MODES, modeAvailability, modeName, modePool, ruleName, startSession, usesIntro, isAutoJudged,
  type PlayConfig, type Session,
} from '@/lib/play'
import { INTRO_MS, setMuted, sfx, unlockSound, useMuted } from '@/lib/sound'
import PlaySetup from './PlaySetup'
import ProgressiveText from './ProgressiveText'
import { DifficultyBadge } from './Difficulty'
import AnswerSearchLink from './AnswerSearchLink'
import { QuizImage } from './QuizImage'
import { IMAGE_CHAR_FACTOR, IMAGE_LEAD_MS, preloadImage, useImageReady, waitForImage } from '@/lib/imagePreload'

type Phase = 'intro' | 'asking' | 'revealed'
type Outcome = 'correct' | 'wrong'
type EndReason = 'done' | 'timeup' | 'miss'

interface Answered { outcome: Outcome; picked?: string | boolean; comboBefore: number }
interface LogEntry { quiz: Quiz; outcome: Outcome; given?: string }

const CHAR_MS = 110

function defaultConfig(pool: Quiz[]): PlayConfig {
  const mode = MODES.map(m => m.id).find(m => modeAvailability(m, pool).ok) ?? 'flash'
  return { ...DEFAULT_CONFIG, mode, count: Math.min(10, Math.max(1, modePool(mode, pool).length)) }
}

export default function QuizStage({
  pool,
  title,
  onClose,
  initialSession,
  canRecord = false,
}: {
  pool: Quiz[]
  title: string
  onClose: () => void
  initialSession?: Session
  // ログイン中のみ成績を保存する
  canRecord?: boolean
}) {
  const muted = useMuted()
  const [config, setConfig] = useState<PlayConfig>(initialSession?.config ?? defaultConfig(pool))
  const [session, setSession] = useState<Session | null>(initialSession ?? null)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>(initialSession && usesIntro(initialSession.config.mode) ? 'intro' : 'asking')
  const [readStart, setReadStart] = useState<number | null>(null)
  const [stopped, setStopped] = useState<number | null>(null)
  const [answered, setAnswered] = useState<Answered | null>(null)
  const [typed, setTyped] = useState('')
  const [log, setLog] = useState<LogEntry[]>([])
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [stamp, setStamp] = useState<{ outcome: Outcome; key: number } | null>(null)
  const [ended, setEnded] = useState<{ reason: EndReason; elapsedMs: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const stampSeq = useRef(0)

  // 回答は次の問題へ進むときに保存する（入力モードの「実は合ってた」を反映するため）
  const pendingRef = useRef<{ memoId: string; correct: boolean } | null>(null)
  const canRecordRef = useRef(canRecord)
  useEffect(() => { canRecordRef.current = canRecord }, [canRecord])
  const flushPending = useCallback(() => {
    const p = pendingRef.current
    pendingRef.current = null
    if (p && canRecordRef.current) recordAnswer(p.memoId, p.correct)
  }, [])
  useEffect(() => () => flushPending(), [flushPending])
  const savedSessionRef = useRef<number | null>(null)

  const screen: 'setup' | 'play' | 'result' = session === null ? 'setup' : ended ? 'result' : 'play'
  const item = session?.items[idx]
  const mode = session?.config.mode ?? config.mode
  const rule = session?.config.rule ?? config.rule
  const quiz = item?.quiz
  const correctCount = log.filter(l => l.outcome === 'correct').length
  // 画像つきの問題は、画像を先に見せてから問題文をゆっくり読み上げる
  const charMs = quiz?.image_url ? Math.round(CHAR_MS * IMAGE_CHAR_FACTOR) : CHAR_MS
  const introImage = screen === 'play' && phase === 'intro' ? quiz?.image_url ?? null : null
  const introImageReady = useImageReady(introImage)
  const nextImage = session?.items[idx + 1]?.quiz.image_url ?? null

  function resetTurn(nextMode: PlayConfig['mode']) {
    setPhase(usesIntro(nextMode) ? 'intro' : 'asking')
    setReadStart(null)
    setStopped(null)
    setAnswered(null)
    setTyped('')
  }

  function begin(s: Session) {
    unlockSound()
    setConfig(s.config)
    setSession(s)
    setIdx(0)
    resetTurn(s.config.mode)
    setLog([])
    setCombo(0)
    setMaxCombo(0)
    setEnded(null)
    setTimeLeft(null)
    setStamp(null)
  }

  function finish(reason: EndReason) {
    if (!session) return
    setEnded({ reason, elapsedMs: performance.now() - session.startedAt })
    sfx.fanfare()
  }

  function record(outcome: Outcome, given?: string) {
    if (!quiz) return
    flushPending()
    pendingRef.current = { memoId: quiz.id, correct: outcome === 'correct' }
    const nextCombo = outcome === 'correct' ? combo + 1 : 0
    setLog(l => [...l, { quiz, outcome, given }])
    setCombo(nextCombo)
    setMaxCombo(m => Math.max(m, nextCombo))
    stampSeq.current += 1
    setStamp({ outcome, key: stampSeq.current })
    if (outcome === 'correct') sfx.correct()
    else sfx.wrong()
  }

  function next(last: Outcome) {
    if (!session) return
    flushPending()
    if (session.config.rule === 'suddendeath' && last === 'wrong') return finish('miss')
    if (idx + 1 >= session.items.length) return finish('done')
    setIdx(idx + 1)
    resetTurn(session.config.mode)
  }

  // 自己採点（めくる・早押し練習・ビジュアル）
  function grade(outcome: Outcome) {
    if (phase !== 'revealed') return
    record(outcome)
    next(outcome)
  }

  // 自動採点（四択・○×・入力）
  function judge(outcome: Outcome, picked?: string | boolean, given?: string) {
    if (phase !== 'asking') return
    setAnswered({ outcome, picked, comboBefore: combo })
    setPhase('revealed')
    record(outcome, given)
  }

  function overrideCorrect() {
    if (!answered || answered.outcome !== 'wrong') return
    const nextCombo = answered.comboBefore + 1
    if (pendingRef.current) pendingRef.current = { ...pendingRef.current, correct: true }
    setLog(l => l.map((e, i) => (i === l.length - 1 ? { ...e, outcome: 'correct' } : e)))
    setCombo(nextCombo)
    setMaxCombo(m => Math.max(m, nextCombo))
    setAnswered({ ...answered, outcome: 'correct' })
    stampSeq.current += 1
    setStamp({ outcome: 'correct', key: stampSeq.current })
    sfx.correct()
  }

  function press() {
    if (phase !== 'asking' || stopped !== null || readStart === null || !quiz) return
    const elapsed = Math.max(0, performance.now() - readStart)
    setStopped(Math.min(quiz.question.length, Math.floor(elapsed / charMs)))
    sfx.buzz()
  }

  function reveal() {
    if (phase !== 'asking') return
    if ((mode === 'buzzer' || mode === 'visual') && stopped === null) return press()
    setPhase('revealed')
  }

  function submitTyped() {
    if (!quiz || !typed.trim()) return
    judge(isCorrectAnswer(typed, quiz.answer) ? 'correct' : 'wrong', undefined, typed.trim())
  }

  function requestClose() {
    if (screen === 'play' && log.length > 0 && !confirm('ゲームを終了しますか？（結果は保存されません）')) return
    onClose()
  }

  // 「てれん！」→ 一拍おいてから出題。画像つきの問題は画像の読み込みを待ち、画像を先に見せてから読み上げる
  useEffect(() => {
    if (screen !== 'play' || phase !== 'intro') return
    sfx.jingle()
    let alive = true
    void Promise.all([new Promise(r => setTimeout(r, INTRO_MS)), waitForImage(introImage)]).then(() => {
      if (!alive) return
      setReadStart(performance.now() + (introImage ? IMAGE_LEAD_MS : 0))
      setPhase('asking')
    })
    return () => { alive = false }
  }, [screen, phase, idx, introImage])

  // 次の問題の画像を先に読み込んでおく
  useEffect(() => {
    if (nextImage) void preloadImage(nextImage)
  }, [nextImage])

  // タイムアタックの残り時間
  useEffect(() => {
    if (screen !== 'play' || !session?.endsAt) return
    const { endsAt, startedAt } = session
    const id = setInterval(() => {
      const left = endsAt - performance.now()
      setTimeLeft(Math.max(0, left))
      if (left <= 0) {
        setEnded({ reason: 'timeup', elapsedMs: endsAt - startedAt })
        sfx.fanfare()
      }
    }, 200)
    return () => clearInterval(id)
  }, [screen, session])

  useEffect(() => {
    if (!stamp) return
    const id = setTimeout(() => setStamp(null), 800)
    return () => clearTimeout(id)
  }, [stamp])

  // ゲームが終わったら、最後の回答と今回の成績をまとめて保存
  useEffect(() => {
    if (!ended || !session) return
    flushPending()
    if (!canRecordRef.current || log.length === 0 || savedSessionRef.current === session.startedAt) return
    savedSessionRef.current = session.startedAt
    recordSession({
      title,
      mode: session.config.mode,
      rule: session.config.rule,
      total: log.length,
      correct: log.filter(l => l.outcome === 'correct').length,
      maxCombo,
      durationMs: ended.elapsedMs,
    })
  }, [ended, session, log, maxCombo, title, flushPending])

  // タイムアタック中は答えを見せたらテンポよく次へ
  const nextRef = useRef(next)
  useEffect(() => { nextRef.current = next })
  useEffect(() => {
    if (screen !== 'play' || rule !== 'timeattack' || phase !== 'revealed' || !answered) return
    const id = setTimeout(() => nextRef.current(answered.outcome), answered.outcome === 'correct' ? 450 : 1100)
    return () => clearTimeout(id)
  }, [screen, rule, phase, answered])

  // キーボード操作（登録は1回、処理は最新の状態で）
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { requestClose(); return }
      if (screen !== 'play' || phase === 'intro' || !item) return
      const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT'
      if (phase === 'asking') {
        if (mode === 'choice' && item.choices && /^[1-4]$/.test(e.key)) {
          const c = item.choices[Number(e.key) - 1]
          if (c !== undefined) judge(c === item.quiz.answer ? 'correct' : 'wrong', c)
        } else if (mode === 'truefalse' && item.tf && !typing) {
          if (e.key === 'o' || e.key === 'ArrowLeft') judge(item.tf.isTrue ? 'correct' : 'wrong', true)
          if (e.key === 'x' || e.key === 'ArrowRight') judge(!item.tf.isTrue ? 'correct' : 'wrong', false)
        } else if (!isAutoJudged(mode) && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault()
          reveal()
        }
        return
      }
      if (typing) return
      if (isAutoJudged(mode) && answered && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        next(answered.outcome)
      } else if (!isAutoJudged(mode)) {
        if (e.key === 'ArrowRight' || e.key === 'l') grade('correct')
        if (e.key === 'ArrowLeft' || e.key === 'j') grade('wrong')
      }
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const total = session?.items.length ?? 0

  return (
    <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto ${STAGE_BG} text-white`}>
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-[#1e1b4b]/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-widest text-indigo-200">
              {screen === 'setup' ? 'クイズ' : `${modeName(mode)} ・ ${ruleName(rule)}`}
            </div>
            <div className="truncate text-sm font-bold">{title}</div>
          </div>
          {screen === 'play' && (
            <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
              {combo >= 2 && <span className="animate-pop-in rounded-full bg-orange-500 px-2.5 py-0.5 text-xs" key={combo}>🔥{combo}連続</span>}
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">⭕ {correctCount}</span>
              {rule === 'timeattack' ? (
                <span className={`rounded-full px-2.5 py-0.5 ${timeLeft !== null && timeLeft < 10000 ? 'bg-rose-500' : 'bg-white/15'}`}>
                  ⏱ {Math.ceil((timeLeft ?? (session?.config.timeLimitSec ?? 0) * 1000) / 1000)}秒
                </span>
              ) : rule === 'normal' ? (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5">{Math.min(idx + 1, total)}/{total}</span>
              ) : null}
            </div>
          )}
          <button onClick={() => setMuted(!muted)} className="rounded-full p-2 text-lg hover:bg-white/10" title={muted ? '音を出す' : 'ミュート'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button onClick={requestClose} className="rounded-full p-2 text-lg leading-none hover:bg-white/10" aria-label="閉じる">✕</button>
        </div>
        {screen === 'play' && (
          <div className="h-1 bg-white/10">
            <div
              className="h-1 bg-gradient-to-r from-amber-300 to-rose-400 transition-all duration-300"
              style={{
                width: `${rule === 'timeattack' && session?.endsAt
                  ? ((timeLeft ?? session.config.timeLimitSec * 1000) / (session.config.timeLimitSec * 1000)) * 100
                  : rule === 'normal' ? (idx / Math.max(1, total)) * 100 : 100}%`,
              }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        {screen === 'setup' && (
          <div className="animate-pop-in rounded-3xl bg-white p-5 text-gray-900 shadow-2xl sm:p-6">
            <div className="mb-4 text-center">
              <div className="text-3xl font-black">{pool.length}<span className="ml-1 text-base font-bold text-gray-500">問</span></div>
              <div className="text-xs text-gray-400">から出題します</div>
            </div>
            <PlaySetup pool={pool} value={config} onChange={setConfig} />
            <button
              onClick={() => begin(startSession(pool, config))}
              disabled={!modeAvailability(config.mode, pool).ok}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-lg font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
            >
              スタート！
            </button>
          </div>
        )}

        {screen === 'play' && item && quiz && (
          <>
            {phase === 'intro' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20">
                <div className="animate-intro text-6xl font-black drop-shadow-lg">第{idx + 1}問</div>
                {introImage && !introImageReady && <div className="text-xs opacity-70">🖼️ 画像を読み込んでいます…</div>}
              </div>
            ) : (
              <>
                {/* 問題 */}
                <div key={idx} className="animate-slide-up rounded-3xl bg-white p-5 text-gray-900 shadow-2xl sm:p-7">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-sm font-black text-white">Q{idx + 1}</span>
                    <DifficultyBadge level={quiz.difficulty} showLabel />
                  </div>
                  {quiz.image_url && (
                    <QuizImage
                      src={quiz.image_url}
                      className={`mx-auto mb-4 rounded-xl object-contain ${mode === 'visual' ? 'max-h-[42vh]' : 'max-h-60'}`}
                    />
                  )}
                  {mode === 'buzzer' || mode === 'visual' ? (
                    <ProgressiveText
                      key={idx}
                      text={quiz.question}
                      startedAt={readStart}
                      charMs={charMs}
                      stopped={phase === 'revealed' ? quiz.question.length : stopped}
                      className="text-xl font-bold leading-relaxed sm:text-2xl"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-xl font-bold leading-relaxed sm:text-2xl">{quiz.question}</p>
                  )}
                  {mode === 'truefalse' && item.tf && (
                    <div className="mt-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
                      <div className="text-xs font-semibold text-indigo-500">答えはこれ。合っている？</div>
                      <div className="mt-0.5 text-2xl font-black text-indigo-950">{item.tf.shown}</div>
                    </div>
                  )}
                  {(mode === 'buzzer' || mode === 'visual') && stopped !== null && phase === 'asking' && (
                    <p className="mt-3 text-center text-sm font-bold text-rose-600">
                      {stopped >= quiz.question.length
                        ? '最後まで読まれました'
                        : stopped === 0
                          ? quiz.image_url ? '画像だけで押しました！' : '読まれる前に押しました！'
                          : `${stopped}文字目で押しました！`}
                    </p>
                  )}
                </div>

                {/* 回答エリア */}
                {phase === 'asking' && mode === 'choice' && item.choices && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {item.choices.map((c, i) => (
                      <button
                        key={c}
                        onClick={() => judge(c === quiz.answer ? 'correct' : 'wrong', c)}
                        className={`${CHOICE_STYLES[i]} flex items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-bold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25 text-sm font-black">{CHOICE_LABELS[i]}</span>
                        <span className="min-w-0 break-words">{c}</span>
                        <span className="ml-auto hidden text-xs font-normal opacity-70 sm:inline">{i + 1}</span>
                      </button>
                    ))}
                  </div>
                )}

                {phase === 'asking' && mode === 'truefalse' && item.tf && (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => judge(item.tf!.isTrue ? 'correct' : 'wrong', true)}
                      className="rounded-3xl bg-rose-500 py-6 text-6xl font-black shadow-lg transition-transform hover:scale-[1.02] active:scale-95">
                      ○<div className="text-xs font-normal opacity-80">合ってる（O）</div>
                    </button>
                    <button onClick={() => judge(!item.tf!.isTrue ? 'correct' : 'wrong', false)}
                      className="rounded-3xl bg-sky-500 py-6 text-6xl font-black shadow-lg transition-transform hover:scale-[1.02] active:scale-95">
                      ×<div className="text-xs font-normal opacity-80">ちがう（X）</div>
                    </button>
                  </div>
                )}

                {phase === 'asking' && mode === 'typing' && (
                  <form onSubmit={e => { e.preventDefault(); submitTyped() }} className="flex gap-2">
                    <input
                      autoFocus
                      value={typed}
                      onChange={e => setTyped(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}
                      placeholder="答えを入力して Enter"
                      className="min-w-0 flex-1 rounded-2xl border-0 bg-white px-4 py-4 text-lg font-bold text-gray-900 shadow-lg outline-none ring-indigo-400 focus:ring-4"
                    />
                    <button type="submit" disabled={!typed.trim()} className="rounded-2xl bg-emerald-500 px-5 font-black shadow-lg disabled:opacity-40">回答</button>
                  </form>
                )}

                {phase === 'asking' && (mode === 'flash' || mode === 'buzzer' || mode === 'visual') && (
                  stopped === null && mode !== 'flash' ? (
                    <button onClick={press} disabled={readStart === null}
                      className="w-full rounded-3xl bg-gradient-to-r from-rose-500 to-orange-500 py-6 text-3xl font-black shadow-xl transition-transform hover:scale-[1.01] active:scale-[0.97]">
                      {mode === 'visual' ? 'わかった！' : '押す！'} <span className="text-sm font-normal opacity-80">Space</span>
                    </button>
                  ) : (
                    <button onClick={() => setPhase('revealed')}
                      className="w-full rounded-3xl bg-white/15 py-4 text-lg font-bold ring-1 ring-white/30 transition-colors hover:bg-white/25">
                      答えを見る <span className="text-xs font-normal opacity-70">Space</span>
                    </button>
                  )
                )}

                {/* 答え */}
                {phase === 'revealed' && (
                  <div className={`rounded-3xl p-5 shadow-xl ${answered ? (answered.outcome === 'correct' ? 'animate-pop-in bg-emerald-50' : 'animate-shake bg-rose-50') : 'animate-pop-in bg-white'} text-gray-900`}>
                    {answered && (
                      <div className={`mb-2 text-lg font-black ${answered.outcome === 'correct' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {answered.outcome === 'correct' ? '⭕ 正解！' : '✗ ざんねん…'}
                        {answered.outcome === 'wrong' && mode === 'choice' && typeof answered.picked === 'string' && (
                          <span className="ml-2 text-sm font-medium text-gray-500">あなたの答え: {answered.picked}</span>
                        )}
                        {answered.outcome === 'wrong' && mode === 'typing' && log.at(-1)?.given && (
                          <span className="ml-2 text-sm font-medium text-gray-500">あなたの答え: {log.at(-1)?.given}</span>
                        )}
                        {mode === 'truefalse' && item.tf && (
                          <span className="ml-2 text-sm font-medium text-gray-500">「{item.tf.shown}」は{item.tf.isTrue ? '正しい' : 'まちがい'}</span>
                        )}
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

                {phase === 'revealed' && !isAutoJudged(mode) && (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => grade('wrong')} className="rounded-2xl bg-sky-500 py-4 text-lg font-black shadow-lg active:scale-95">
                      ✗ まちがえた <span className="text-xs font-normal opacity-80">← J</span>
                    </button>
                    <button onClick={() => grade('correct')} className="rounded-2xl bg-rose-500 py-4 text-lg font-black shadow-lg active:scale-95">
                      ○ 正解！ <span className="text-xs font-normal opacity-80">L →</span>
                    </button>
                  </div>
                )}

                {phase === 'revealed' && isAutoJudged(mode) && answered && rule !== 'timeattack' && (
                  <div className="flex gap-2">
                    {mode === 'typing' && answered.outcome === 'wrong' && (
                      <button onClick={overrideCorrect} className="rounded-2xl bg-white/15 px-4 py-4 text-sm font-bold ring-1 ring-white/30 hover:bg-white/25">
                        実は合ってた（正解にする）
                      </button>
                    )}
                    <button onClick={() => next(answered.outcome)} className="flex-1 rounded-2xl bg-white py-4 text-lg font-black text-indigo-900 shadow-lg active:scale-[0.98]">
                      {rule === 'suddendeath' && answered.outcome === 'wrong' ? '結果を見る' : idx + 1 >= total ? '結果を見る' : '次へ →'}
                      <span className="ml-1 text-xs font-normal text-gray-400">Enter</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {screen === 'result' && session && ended && (
          <ResultView
            log={log}
            reason={ended.reason}
            elapsedMs={ended.elapsedMs}
            maxCombo={maxCombo}
            rule={rule}
            recorded={canRecord}
            onRetryWrong={wrong => begin(startSession(wrong, { ...session.config, rule: 'normal', count: wrong.length }, pool))}
            onRetry={() => begin(startSession(pool, session.config))}
            onSettings={() => setSession(null)}
            onClose={onClose}
          />
        )}
      </main>

      {stamp && (
        <div key={stamp.key} className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <span className={`animate-stamp text-[11rem] font-black leading-none drop-shadow-2xl ${stamp.outcome === 'correct' ? 'text-rose-500' : 'text-sky-400'}`}>
            {stamp.outcome === 'correct' ? '○' : '×'}
          </span>
        </div>
      )}
    </div>
  )
}

function ResultView({
  log, reason, elapsedMs, maxCombo, rule, recorded, onRetryWrong, onRetry, onSettings, onClose,
}: {
  log: LogEntry[]
  reason: EndReason
  elapsedMs: number
  maxCombo: number
  rule: PlayConfig['rule']
  recorded: boolean
  onRetryWrong: (wrong: Quiz[]) => void
  onRetry: () => void
  onSettings: () => void
  onClose: () => void
}) {
  const correct = log.filter(l => l.outcome === 'correct').length
  const wrong = log.filter(l => l.outcome === 'wrong').map(l => l.quiz)
  const acc = log.length > 0 ? Math.round((correct / log.length) * 100) : 0
  const sec = Math.round(elapsedMs / 1000)
  const headline =
    rule === 'suddendeath' ? `${correct}問 連続正解！` :
    rule === 'timeattack' ? `${correct}問 正解！` :
    acc >= 90 ? '🏆 すばらしい！' : acc >= 70 ? '🎉 いい調子！' : acc >= 40 ? '👍 その調子！' : '💪 もう一回いってみよう！'

  return (
    <div className="animate-pop-in flex flex-col gap-4 rounded-3xl bg-white p-6 text-gray-900 shadow-2xl">
      <div className="text-center">
        <div className="text-sm font-bold text-indigo-600">
          {reason === 'timeup' ? '⏰ タイムアップ！' : reason === 'miss' ? '💀 ゲームオーバー' : '🏁 クリア！'}
        </div>
        <div className="mt-1 text-2xl font-black">{headline}</div>
        <div className="mt-2 text-6xl font-black tabular-nums">
          {correct}<span className="text-2xl text-gray-300">/{log.length}</span>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-sm text-gray-500">
          <span>正解率 <b className="text-gray-900">{acc}%</b></span>
          <span>最大 <b className="text-gray-900">{maxCombo}</b> 連続</span>
          <span>{sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`}</span>
        </div>
      </div>

      {log.length > 0 && (
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-100">
          {log.map((l, i) => (
            <li key={i} className="flex items-start gap-3 px-3 py-2 text-sm">
              <span className={`mt-0.5 text-lg font-black leading-none ${l.outcome === 'correct' ? 'text-rose-500' : 'text-sky-500'}`}>
                {l.outcome === 'correct' ? '○' : '×'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-gray-700">{l.quiz.question}</span>
                <span className="font-bold text-emerald-700">→ {l.quiz.answer}</span>
                {l.outcome === 'wrong' && l.given && <span className="ml-2 text-xs text-gray-400">（あなた: {l.given}）</span>}
              </span>
              <AnswerSearchLink answer={l.quiz.answer} className="mt-0.5" />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        {wrong.length > 0 && (
          <button onClick={() => onRetryWrong(wrong)} className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-black text-white shadow">
            まちがえた{wrong.length}問だけ再挑戦
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onRetry} className="rounded-2xl border-2 border-indigo-100 py-3 font-bold text-indigo-700 hover:bg-indigo-50">もう一度</button>
          <button onClick={onSettings} className="rounded-2xl border-2 border-gray-100 py-3 font-bold text-gray-600 hover:bg-gray-50">あそびかたを変える</button>
        </div>
        <button onClick={onClose} className="py-2 text-sm text-gray-400 hover:text-gray-600">終了</button>
        {recorded && (
          <p className="text-center text-xs text-gray-400">
            📈 結果を記録しました ・ <Link href="/dashboard/study" className="text-indigo-600 hover:underline">勉強モードで苦手を復習する</Link>
          </p>
        )}
      </div>
    </div>
  )
}
