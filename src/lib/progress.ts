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

export function masteryOf(p: QuizProgress | undefined): Mastery {
  if (!p) return 'new'
  if (p.level >= 4) return 'mastered'
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

export function countMastery(ids: readonly string[], progress: ReadonlyMap<string, QuizProgress>): Record<Mastery, number> {
  const out: Record<Mastery, number> = { new: 0, learning: 0, almost: 0, mastered: 0 }
  for (const id of ids) out[masteryOf(progress.get(id))]++
  return out
}
