import type { Quiz } from '@/types'
import { isCorrectAnswer } from './quiz'

export type RoomPhase = 'lobby' | 'reading' | 'buzzed' | 'judged' | 'finished'

export interface RoomResult {
  name: string
  correct: boolean
  answerText: string | null
}

// ホストが全員に配信する公開状態。答え・解説・ジャンルは judged になるまで含めない。
export interface RoomState {
  phase: RoomPhase
  title: string
  index: number
  total: number
  question: string
  difficulty: number | null
  tags: string[]
  charMs: number
  // 問題文が出きってから押せる時間 / 押してから回答できる時間。null は無制限
  buzzWindowMs: number | null
  answerLimitMs: number | null
  readSeq: number
  readFrom: number
  paused: number | null
  buzzSeq: number
  buzzer: { id: string; name: string } | null
  buzzAnswer: string | null
  lockedOut: string[]
  result: RoomResult | null
  answer: string | null
  explanation: string | null
  scores: Record<string, { name: string; score: number }>
}

export const INITIAL_ROOM_STATE: RoomState = {
  phase: 'lobby',
  title: '',
  index: 0,
  total: 0,
  question: '',
  difficulty: null,
  tags: [],
  charMs: 110,
  buzzWindowMs: 5000,
  answerLimitMs: 15000,
  readSeq: 0,
  readFrom: 0,
  paused: null,
  buzzSeq: 0,
  buzzer: null,
  buzzAnswer: null,
  lockedOut: [],
  result: null,
  answer: null,
  explanation: null,
  scores: {},
}

export interface RoomSettings {
  charMs: number
  buzzWindowMs: number | null
  answerLimitMs: number | null
}

export type HostEngine = ReturnType<typeof createHostEngine>

export function createHostEngine(opts: {
  title: string
  // ホスト自身の画面に反映（currentAnswer はホストだけが見る正解）
  apply: (s: RoomState, currentAnswer: string | null) => void
  // 他の参加者に配信
  send: (s: RoomState) => void
  activePlayerIds: () => string[]
}) {
  let state: RoomState = { ...INITIAL_ROOM_STATE, title: opts.title }
  let order: Quiz[] = []
  let readStartedAt = 0
  let readTimer: ReturnType<typeof setTimeout> | null = null
  let answerTimer: ReturnType<typeof setTimeout> | null = null

  const current = () => order[state.index] as Quiz | undefined

  function publish(next: RoomState) {
    state = next
    opts.apply(next, next.phase === 'buzzed' || next.phase === 'judged' ? current()?.answer ?? null : null)
    opts.send(next)
  }

  function clearTimers() {
    if (readTimer) clearTimeout(readTimer)
    if (answerTimer) clearTimeout(answerTimer)
    readTimer = answerTimer = null
  }

  function beginReading(next: RoomState) {
    clearTimers()
    readStartedAt = performance.now()
    publish(next)
    if (next.buzzWindowMs === null) return
    const seq = next.readSeq
    const remaining = Math.max(0, next.question.length - next.readFrom) * next.charMs
    readTimer = setTimeout(() => {
      if (state.phase === 'reading' && state.readSeq === seq) reveal(null)
    }, remaining + next.buzzWindowMs)
  }

  function reveal(result: RoomResult | null) {
    clearTimers()
    const q = current()
    publish({
      ...state,
      phase: 'judged',
      paused: state.question.length,
      buzzer: null,
      result,
      answer: q?.answer ?? null,
      explanation: q?.explanation ?? null,
      tags: q?.tags ?? [],
    })
  }

  function goTo(i: number) {
    const q = order[i]
    if (!q) {
      finish()
      return
    }
    beginReading({
      ...state,
      phase: 'reading',
      index: i,
      total: order.length,
      question: q.question,
      difficulty: q.difficulty,
      // ジャンルは答えのヒントになるので、判定が出るまで配信しない
      tags: [],
      readSeq: state.readSeq + 1,
      readFrom: 0,
      paused: null,
      buzzer: null,
      buzzAnswer: null,
      lockedOut: [],
      result: null,
      answer: null,
      explanation: null,
    })
  }

  function judge(correct: boolean) {
    if (state.phase !== 'buzzed' || !state.buzzer) return
    clearTimers()
    const b = state.buzzer
    const prev = state.scores[b.id]?.score ?? 0
    const scores = { ...state.scores, [b.id]: { name: b.name, score: prev + (correct ? 1 : 0) } }
    const result: RoomResult = { name: b.name, correct, answerText: state.buzzAnswer }

    if (correct) {
      state = { ...state, scores }
      reveal(result)
      return
    }
    const lockedOut = [...state.lockedOut, b.id]
    const stillIn = opts.activePlayerIds().filter(id => !lockedOut.includes(id))
    if (stillIn.length === 0) {
      state = { ...state, scores, lockedOut }
      reveal({ ...result })
      return
    }
    beginReading({
      ...state,
      phase: 'reading',
      scores,
      lockedOut,
      readSeq: state.readSeq + 1,
      readFrom: state.paused ?? 0,
      paused: null,
      buzzer: null,
      buzzAnswer: null,
      result,
    })
  }

  function finish() {
    clearTimers()
    publish({ ...state, phase: 'finished', buzzer: null })
  }

  return {
    start(quizzes: Quiz[], settings: RoomSettings, members: { id: string; name: string }[]) {
      order = quizzes
      state = {
        ...state,
        ...settings,
        scores: Object.fromEntries(members.map(m => [m.id, { name: m.name, score: 0 }])),
      }
      goTo(0)
    },

    buzz(p: { id: string; name: string }) {
      if (state.phase !== 'reading' || state.lockedOut.includes(p.id)) return
      clearTimers()
      const revealed = Math.min(
        state.question.length,
        state.readFrom + Math.floor((performance.now() - readStartedAt) / state.charMs),
      )
      const scores = state.scores[p.id] ? state.scores : { ...state.scores, [p.id]: { name: p.name, score: 0 } }
      const seq = state.buzzSeq + 1
      publish({ ...state, phase: 'buzzed', paused: revealed, buzzer: p, buzzAnswer: null, buzzSeq: seq, result: null, scores })
      if (state.answerLimitMs === null) return
      answerTimer = setTimeout(() => {
        if (state.phase === 'buzzed' && state.buzzSeq === seq && state.buzzAnswer === null) {
          state = { ...state, buzzAnswer: '時間切れ' }
          judge(false)
        }
      }, state.answerLimitMs)
    },

    answer(p: { id: string; text: string }) {
      if (state.phase !== 'buzzed' || state.buzzer?.id !== p.id || state.buzzAnswer !== null) return
      if (answerTimer) clearTimeout(answerTimer)
      answerTimer = null
      const text = p.text.trim()
      state = { ...state, buzzAnswer: text || '無回答' }
      const q = current()
      if (!text) return judge(false)
      if (q && isCorrectAnswer(text, q.answer)) return judge(true)
      publish(state)
    },

    judge,
    next: () => goTo(state.index + 1),
    skip: () => reveal(null),
    finish,

    backToLobby() {
      clearTimers()
      publish({
        ...INITIAL_ROOM_STATE,
        title: state.title,
        charMs: state.charMs,
        buzzWindowMs: state.buzzWindowMs,
        answerLimitMs: state.answerLimitMs,
        readSeq: state.readSeq,
        buzzSeq: state.buzzSeq,
      })
    },

    resync: () => opts.send(state),
    dispose: clearTimers,
  }
}
