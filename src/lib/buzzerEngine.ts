import type { Quiz } from '@/types'
import { isCorrectAnswer } from './quiz'
import { INTRO_MS } from './sound'
import { IMAGE_CHAR_FACTOR, IMAGE_LEAD_MS, IMAGE_WAIT_MAX_MS } from './imagePreload'

// intro: 「てれん！」を鳴らして一拍おく間。問題文はまだ配信しない。
//   画像つきの問題は、この間に全員が画像を読み込み（preloadUrl）、そろってから（最大 IMAGE_WAIT_MAX_MS 待って）読み上げる
export type RoomPhase = 'lobby' | 'intro' | 'reading' | 'buzzed' | 'judged' | 'finished'

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
  imageUrl: string | null
  // intro 中に先読みしておく今の問題の画像 / 次の問題の画像
  preloadUrl: string | null
  nextImageUrl: string | null
  // intro 中、画像を読み込めた人数（画像つきの問題で、そろうのを待っているとき）
  waitingImages: { ready: number; total: number } | null
  // 読み上げ開始から問題文が出はじめるまでの時間（画像を先に見せる）
  textDelayMs: number
  difficulty: number | null
  tags: string[]
  // この問題の1文字あたりの時間（画像つきの問題はゆっくり）
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
  imageUrl: null,
  preloadUrl: null,
  nextImageUrl: null,
  waitingImages: null,
  textDelayMs: 0,
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
  let baseCharMs = INITIAL_ROOM_STATE.charMs
  let readStartedAt = 0
  let readTimer: ReturnType<typeof setTimeout> | null = null
  let answerTimer: ReturnType<typeof setTimeout> | null = null
  let introTimer: ReturnType<typeof setTimeout> | null = null
  let waitTimer: ReturnType<typeof setTimeout> | null = null
  // 今の問題の画像を読み込めた参加者
  let readyIds = new Set<string>()
  let introDone = false

  const current = () => order[state.index] as Quiz | undefined

  function publish(next: RoomState) {
    state = next
    opts.apply(next, next.phase === 'buzzed' || next.phase === 'judged' ? current()?.answer ?? null : null)
    opts.send(next)
  }

  function clearTimers() {
    if (readTimer) clearTimeout(readTimer)
    if (answerTimer) clearTimeout(answerTimer)
    if (introTimer) clearTimeout(introTimer)
    if (waitTimer) clearTimeout(waitTimer)
    readTimer = answerTimer = introTimer = waitTimer = null
  }

  function beginReading(next: RoomState) {
    clearTimers()
    readStartedAt = performance.now()
    publish(next)
    if (next.buzzWindowMs === null) return
    const seq = next.readSeq
    const remaining = next.textDelayMs + Math.max(0, next.question.length - next.readFrom) * next.charMs
    readTimer = setTimeout(() => {
      if (state.phase === 'reading' && state.readSeq === seq) reveal(null)
    }, remaining + next.buzzWindowMs)
  }

  // intro が終わり、画像つきなら全員の読み込みがそろったら読み上げを始める
  function startReading(i: number) {
    const q = order[i]
    if (!q || state.phase !== 'intro' || state.index !== i) return
    beginReading({
      ...state,
      phase: 'reading',
      question: q.question,
      imageUrl: q.image_url,
      waitingImages: null,
      textDelayMs: q.image_url ? IMAGE_LEAD_MS : 0,
      readSeq: state.readSeq + 1,
      readFrom: 0,
    })
  }

  function maybeStartReading() {
    const q = current()
    if (!q || state.phase !== 'intro' || !introDone) return
    if (!q.image_url) return startReading(state.index)
    const active = opts.activePlayerIds()
    const ready = active.filter(id => readyIds.has(id)).length
    if (ready >= active.length) return startReading(state.index)
    if (state.waitingImages?.ready !== ready || state.waitingImages?.total !== active.length) {
      publish({ ...state, waitingImages: { ready, total: active.length } })
    }
  }

  function reveal(result: RoomResult | null) {
    clearTimers()
    const q = current()
    const question = q?.question ?? state.question
    publish({
      ...state,
      phase: 'judged',
      question,
      imageUrl: q?.image_url ?? state.imageUrl,
      paused: question.length,
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
    clearTimers()
    readyIds = new Set()
    introDone = false
    // 「てれん！」の間は問題文を送らず、画像だけ先に読み込んでもらう
    publish({
      ...state,
      phase: 'intro',
      index: i,
      total: order.length,
      question: '',
      imageUrl: null,
      preloadUrl: q.image_url,
      nextImageUrl: order[i + 1]?.image_url ?? null,
      waitingImages: null,
      textDelayMs: 0,
      charMs: q.image_url ? Math.round(baseCharMs * IMAGE_CHAR_FACTOR) : baseCharMs,
      difficulty: q.difficulty,
      // ジャンルは答えのヒントになるので、判定が出るまで配信しない
      tags: [],
      paused: null,
      buzzer: null,
      buzzAnswer: null,
      lockedOut: [],
      result: null,
      answer: null,
      explanation: null,
    })
    introTimer = setTimeout(() => {
      introTimer = null
      introDone = true
      maybeStartReading()
    }, INTRO_MS)
    // 読み込めない人がいても、待つのはここまで
    if (q.image_url) waitTimer = setTimeout(() => { waitTimer = null; startReading(i) }, INTRO_MS + IMAGE_WAIT_MAX_MS)
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
      // 続きから再開するときは画像をもう見ているので、すぐ問題文を出す
      textDelayMs: 0,
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
      baseCharMs = settings.charMs
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
        state.readFrom + Math.max(0, Math.floor((performance.now() - readStartedAt - state.textDelayMs) / state.charMs)),
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

    // 参加者の画面で今の問題の画像を読み込めた（失敗も含む）
    imageReady(p: { id: string; index: number }) {
      if (state.phase !== 'intro' || p.index !== state.index) return
      readyIds.add(p.id)
      maybeStartReading()
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
        charMs: baseCharMs,
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
