import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizProgress, QuizWithSource } from '@/types'
import { uniqueTags } from '@/lib/quiz'
import { fetchAll } from './fetchAll'

export async function fetchMyQuizzes(supabase: SupabaseClient, userId: string): Promise<QuizWithSource[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('memos')
      .select('id, question, answer, explanation, difficulty, tags, image_url, item_id, items(title, shelf_id)', { count: 'exact' })
      .eq('user_id', userId)
      .eq('type', 'qa')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  )
  return rows.map(m => {
    const item = m.items as unknown as { title: string; shelf_id: string } | null
    return {
      id: m.id,
      question: m.question ?? '',
      answer: m.answer ?? '',
      explanation: m.explanation ?? null,
      difficulty: m.difficulty ?? null,
      tags: uniqueTags(m.tags),
      image_url: m.image_url ?? null,
      item_id: m.item_id,
      item_title: item?.title ?? null,
      shelf_id: item?.shelf_id ?? null,
    }
  })
}

export function fetchMyProgress(supabase: SupabaseClient, userId: string): Promise<QuizProgress[]> {
  return fetchAll<QuizProgress>((from, to) =>
    supabase
      .from('quiz_progress')
      .select('memo_id, correct_count, wrong_count, level, last_result, last_answered_at, due_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('memo_id')
      .range(from, to),
  )
}
