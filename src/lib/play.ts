import type { Quiz } from '@/types'
import { buildChoices, distinctAnswerCount, pickDistractors, shuffle } from './quiz'

export type PlayMode = 'flash' | 'choice' | 'truefalse' | 'typing' | 'buzzer' | 'visual'
export type PlayRule = 'normal' | 'timeattack' | 'suddendeath'

export interface PlayConfig {
  mode: PlayMode
  rule: PlayRule
  count: number
  timeLimitSec: number
}

export const DEFAULT_CONFIG: PlayConfig = { mode: 'choice', rule: 'normal', count: 10, timeLimitSec: 60 }

export const MODES: { id: PlayMode; icon: string; name: string; desc: string; tone: string }[] = [
  { id: 'choice', icon: '🔢', name: '四択', desc: '4つの中から選ぶ', tone: 'from-sky-500 to-indigo-500' },
  { id: 'truefalse', icon: '⭕', name: '○×', desc: '出てきた答えが合ってる？', tone: 'from-rose-500 to-orange-400' },
  { id: 'typing', icon: '⌨️', name: '入力', desc: '答えを打って自動採点', tone: 'from-emerald-500 to-teal-500' },
  { id: 'flash', icon: '🃏', name: 'めくる', desc: '答えを見て自己採点', tone: 'from-violet-500 to-fuchsia-500' },
  { id: 'buzzer', icon: '⚡', name: '早押し練習', desc: '問題文が少しずつ出る', tone: 'from-amber-500 to-rose-500' },
  { id: 'visual', icon: '🖼️', name: 'ビジュアル', desc: '画像がだんだんはっきり', tone: 'from-cyan-500 to-blue-600' },
]

export const RULES: { id: PlayRule; icon: string; name: string; desc: string }[] = [
  { id: 'normal', icon: '🎯', name: 'ふつう', desc: '決めた問題数だけ' },
  { id: 'timeattack', icon: '⏱️', name: 'タイムアタック', desc: '時間内に何問とけるか' },
  { id: 'suddendeath', icon: '💀', name: 'サドンデス', desc: '1問まちがえたら終了' },
]

export const TIME_LIMITS = [30, 60, 120, 180]

// タイムアタック・サドンデスで一度に用意する最大問題数
const ENDLESS_CAP = 300

export const modeName = (m: PlayMode) => MODES.find(x => x.id === m)?.name ?? m
export const ruleName = (r: PlayRule) => RULES.find(x => x.id === r)?.name ?? r

export function modePool(mode: PlayMode, pool: readonly Quiz[]): Quiz[] {
  return mode === 'visual' ? pool.filter(q => q.image_url) : [...pool]
}

export function modeAvailability(mode: PlayMode, pool: readonly Quiz[]): { ok: boolean; reason?: string } {
  if (pool.length === 0) return { ok: false, reason: '問題がありません' }
  if (mode === 'choice' && distinctAnswerCount(pool) < 4) return { ok: false, reason: '答えが4種類以上必要です' }
  if (mode === 'truefalse' && distinctAnswerCount(pool) < 2) return { ok: false, reason: '答えが2種類以上必要です' }
  if (mode === 'visual' && !pool.some(q => q.image_url)) return { ok: false, reason: '画像付きの問題がありません' }
  return { ok: true }
}

export function ruleAvailable(mode: PlayMode, rule: PlayRule): boolean {
  // 文字や画像を少しずつ見せるモードは時間を競う遊び方と相性が悪いので除外
  return !(rule === 'timeattack' && (mode === 'buzzer' || mode === 'visual'))
}

export const usesIntro = (mode: PlayMode) => mode === 'buzzer' || mode === 'visual'
export const isAutoJudged = (mode: PlayMode) => mode === 'choice' || mode === 'truefalse' || mode === 'typing'

export interface PlayItem {
  quiz: Quiz
  choices: string[] | null
  tf: { shown: string; isTrue: boolean } | null
}

export interface Session {
  config: PlayConfig
  items: PlayItem[]
  startedAt: number
  endsAt: number | null
}

// ランダムな要素（出題順・選択肢）はここで一度だけ決める。イベントハンドラーから呼ぶこと。
export function startSession(questions: readonly Quiz[], config: PlayConfig, distractorPool: readonly Quiz[] = questions): Session {
  const base = shuffle(modePool(config.mode, questions))
  const n = config.rule === 'normal' ? Math.min(config.count, base.length) : Math.min(base.length, ENDLESS_CAP)
  const items = base.slice(0, n).map(quiz => {
    let tf: PlayItem['tf'] = null
    if (config.mode === 'truefalse') {
      const wrong = pickDistractors(quiz, distractorPool, 1)[0]
      const isTrue = !wrong || Math.random() < 0.5
      tf = { shown: isTrue ? quiz.answer : wrong, isTrue }
    }
    return { quiz, choices: config.mode === 'choice' ? buildChoices(quiz, distractorPool) : null, tf }
  })
  const now = performance.now()
  return {
    config,
    items,
    startedAt: now,
    endsAt: config.rule === 'timeattack' ? now + config.timeLimitSec * 1000 : null,
  }
}
