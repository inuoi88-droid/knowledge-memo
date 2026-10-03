import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublicSource, Quiz, QuizProgress, QuizSource, QuizWithSource, ShelfNode, SourceType } from '@/types'
import { toQuiz, uniqueTags } from '@/lib/quiz'
import { fetchAll } from './fetchAll'

const QUIZ_COLUMNS = 'id, question, answer, explanation, difficulty, tags, image_url'

export async function fetchMyQuizzes(supabase: SupabaseClient, userId: string): Promise<QuizWithSource[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('memos')
      .select(`${QUIZ_COLUMNS}, position, item_id, items(title, shelf_id)`, { count: 'exact' })
      .eq('user_id', userId)
      .eq('type', 'qa')
      .order('created_at', { ascending: false })
      .order('position')
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
      position: m.position,
    }
  })
}

export function fetchMyProgress(supabase: SupabaseClient, userId: string): Promise<QuizProgress[]> {
  return fetchAll<QuizProgress>((from, to) =>
    supabase
      .from('quiz_progress')
      .select('memo_id, correct_count, wrong_count, level, last_result, last_answered_at, due_at, introduced_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('memo_id')
      .range(from, to),
  )
}

// 本棚の画面と同じ並び（新しい順）
export async function fetchMyShelfTree(supabase: SupabaseClient, userId: string): Promise<ShelfNode[]> {
  const { data } = await supabase
    .from('shelves')
    .select('id, name, is_public, items(id, title, source_type, is_public, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'items', ascending: false })
  return (data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    is_public: s.is_public,
    items: ((s.items ?? []) as { id: string; title: string; source_type: SourceType; is_public: boolean }[])
      .map(i => ({ id: i.id, title: i.title, source_type: i.source_type, is_public: i.is_public })),
  }))
}

// 本棚・アイテムのクイズ（自分のもの、または公開されているもの）。追加した順
export async function fetchSourceQuizzes(supabase: SupabaseClient, source: QuizSource): Promise<(Quiz & { item_id: string })[]> {
  const rows = await fetchAll((from, to) => {
    const q = source.kind === 'item'
      ? supabase.from('memos').select(`${QUIZ_COLUMNS}, item_id`, { count: 'exact' }).eq('item_id', source.id)
      : supabase.from('memos').select(`${QUIZ_COLUMNS}, item_id, items!inner(shelf_id)`, { count: 'exact' }).eq('items.shelf_id', source.id)
    return q.eq('type', 'qa').order('position').order('id').range(from, to)
  })
  return rows.map(r => ({ ...toQuiz(r as unknown as Parameters<typeof toQuiz>[0]), item_id: (r as { item_id: string }).item_id }))
}

export async function fetchSourceTitle(supabase: SupabaseClient, source: QuizSource): Promise<string | null> {
  const { data } = source.kind === 'item'
    ? await supabase.from('items').select('title').eq('id', source.id).maybeSingle()
    : await supabase.from('shelves').select('title:name').eq('id', source.id).maybeSingle()
  return data?.title ?? null
}

export async function fetchPublicSources(supabase: SupabaseClient): Promise<PublicSource[]> {
  const { data } = await supabase.rpc('list_public_quiz_sources')
  return ((data ?? []) as { kind: 'shelf' | 'item'; id: string; title: string; author_name: string | null; quiz_count: number; published_at: string | null; is_mine: boolean }[])
    .map(r => ({ ...r, quiz_count: Number(r.quiz_count) }))
}
