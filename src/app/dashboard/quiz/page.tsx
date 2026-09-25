import { createClient, getUser } from '@/lib/supabase/server'
import QuizHub from '@/components/quiz/QuizHub'
import type { QuizSet, QuizWithSource } from '@/types'

type SetRow = Omit<QuizSet, 'quiz_count'> & { quiz_set_items: { count: number }[] }

function toSet(row: SetRow): QuizSet {
  const { quiz_set_items, ...rest } = row
  return { ...rest, quiz_count: quiz_set_items?.[0]?.count ?? 0 }
}

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; tab?: string }>
}) {
  const { genre, tab } = await searchParams
  const supabase = await createClient()
  const user = (await getUser())!

  const [{ data: memos }, { data: mySets }, { data: publicSets }] = await Promise.all([
    supabase
      .from('memos')
      .select('id, question, answer, explanation, difficulty, tags, item_id, items(title, shelf_id)')
      .eq('user_id', user.id)
      .eq('type', 'qa')
      .order('created_at', { ascending: false }),
    supabase
      .from('quiz_sets')
      .select('*, quiz_set_items(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('quiz_sets')
      .select('*, quiz_set_items(count)')
      .eq('is_public', true)
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const quizzes: QuizWithSource[] = (memos ?? []).map(m => {
    const item = m.items as unknown as { title: string; shelf_id: string } | null
    return {
      id: m.id,
      question: m.question ?? '',
      answer: m.answer ?? '',
      explanation: m.explanation ?? null,
      difficulty: m.difficulty ?? null,
      tags: m.tags ?? [],
      item_id: m.item_id,
      item_title: item?.title ?? null,
      shelf_id: item?.shelf_id ?? null,
    }
  })

  const meta = user.user_metadata ?? {}
  const authorName: string = meta.full_name || meta.name || user.email?.split('@')[0] || '名無し'
  const initialTab = tab === 'mine' || tab === 'public' ? tab : 'list'

  return (
    <QuizHub
      quizzes={quizzes}
      mySets={((mySets ?? []) as SetRow[]).map(toSet)}
      publicSets={((publicSets ?? []) as SetRow[]).map(toSet)}
      initialGenre={genre ?? null}
      initialTab={initialTab}
      authorName={authorName}
    />
  )
}
