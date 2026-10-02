import type { QuizProgress } from '@/types'
import { createClient } from './supabase/client'

// ---- 記録（失敗してもゲームは止めない） ----

export function recordAnswer(memoId: string, correct: boolean) {
  void createClient()
    .rpc('record_answer', { p_memo_id: memoId, p_correct: correct })
    .then(({ error }) => { if (error) console.warn('record_answer failed', error.message) })
}

export function recordSession(s: {
  title: string
  mode: string
  rule: string
  total: number
  correct: number
  maxCombo: number
  durationMs: number
}) {
  void createClient()
    .from('play_sessions')
    .insert({
      title: s.title.slice(0, 200),
      mode: s.mode,
      rule: s.rule,
      total: s.total,
      correct: s.correct,
      max_combo: s.maxCombo,
      duration_ms: Math.round(s.durationMs),
    })
    .then(({ error }) => { if (error) console.warn('play_sessions insert failed', error.message) })
}

// ---- 覚えた度の見せ方 ----

export type Mastery = 'new' | 'learning' | 'almost' | 'mastered'

export const MASTERY: Record<Mastery, { label: string; color: string; text: string }> = {
  mastered: { label: '覚えた', color: 'bg-emerald-500', text: 'text-emerald-700' },
  almost: { label: 'あと少し', color: 'bg-sky-500', text: 'text-sky-700' },
  learning: { label: '学習中', color: 'bg-amber-400', text: 'text-amber-700' },
  new: { label: '未学習', color: 'bg-gray-200', text: 'text-gray-500' },
}

export const MASTERY_ORDER: Mastery[] = ['mastered', 'almost', 'learning', 'new']

// 復習の段階が「最後から2つめ」まで進んだら覚えた（既定の5段階なら4回目以降）
export function masteryOf(p: QuizProgress | undefined, steps = DEFAULT_STUDY_SETTINGS.reviewDays.length): Mastery {
  if (!p) return 'new'
  if (p.level >= Math.max(1, steps - 1)) return 'mastered'
  if (p.level >= 2) return 'almost'
  return 'learning'
}

export function isDue(p: QuizProgress | undefined, now: number): boolean {
  return !!p?.due_at && Date.parse(p.due_at) <= now
}

// 苦手：直近でまちがえた、またはまちがいの方が多い
export function isWeak(p: QuizProgress | undefined): boolean {
  return !!p && p.wrong_count > 0 && (p.last_result === false || p.wrong_count >= p.correct_count)
}

export function countMastery(ids: readonly string[], progress: ReadonlyMap<string, QuizProgress>, steps?: number): Record<Mastery, number> {
  const out: Record<Mastery, number> = { new: 0, learning: 0, almost: 0, mastered: 0 }
  for (const id of ids) out[masteryOf(progress.get(id), steps)]++
  return out
}

// ---- 勉強モードの設定 ----

export interface StudySettings {
  reviewDays: number[]
  checkRepeats: number
  reviewStyle: 'typing' | 'cards'
}

export const DEFAULT_STUDY_SETTINGS: StudySettings = {
  reviewDays: [1, 3, 7, 14, 30],
  checkRepeats: 2,
  reviewStyle: 'typing',
}

export const REVIEW_PRESETS: { name: string; desc: string; days: number[] }[] = [
  { name: '標準', desc: 'はじめはこれ', days: [1, 3, 7, 14, 30] },
  { name: 'こまめに', desc: '忘れやすい人・試験前に', days: [1, 2, 4, 7, 14, 30] },
  { name: '間隔広め', desc: '覚えるのが早い人に', days: [2, 7, 21, 60] },
]

export const MAX_REVIEW_STEPS = 8

export function toStudySettings(row: { review_days: number[]; check_repeats: number; review_style: string } | null): StudySettings {
  if (!row) return DEFAULT_STUDY_SETTINGS
  return {
    reviewDays: row.review_days,
    checkRepeats: row.check_repeats,
    reviewStyle: row.review_style === 'cards' ? 'cards' : 'typing',
  }
}

export async function saveStudySettings(s: StudySettings): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'ログインが必要です'
  const { error } = await supabase.from('study_settings').upsert({
    user_id: user.id,
    review_days: s.reviewDays,
    check_repeats: s.checkRepeats,
    review_style: s.reviewStyle,
    updated_at: new Date().toISOString(),
  })
  return error?.message ?? null
}

export function formatDays(d: number): string {
  if (d % 30 === 0) return `${d / 30}か月`
  if (d % 7 === 0) return `${d / 7}週間`
  return `${d}日`
}
