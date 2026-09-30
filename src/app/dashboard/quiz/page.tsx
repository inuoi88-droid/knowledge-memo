import { createClient, getUser } from '@/lib/supabase/server'
import { fetchMyProgress, fetchMyQuizzes } from '@/lib/supabase/queries'
import { getNow } from '@/lib/stage'
import QuizHub, { type HubTab } from '@/components/quiz/QuizHub'
import { MODES } from '@/lib/play'
import type { QuizSet } from '@/types'

type SetRow = Omit<QuizSet, 'quiz_count'> & { quiz_set_items: { count: number }[] }

function toSet(row: SetRow): QuizSet {
  const { quiz_set_items, ...rest } = row
  return { ...rest, quiz_count: quiz_set_items?.[0]?.count ?? 0 }
}

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; tab?: string; play?: string }>
}) {
  const { genre, tab, play } = await searchParams
  const supabase = await createClient()
  const user = (await getUser())!

  const [quizzes, progress, { data: mySets }, { data: publicSets }] = await Promise.all([
    fetchMyQuizzes(supabase, user.id),
    fetchMyProgress(supabase, user.id),
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

  const meta = user.user_metadata ?? {}
  const authorName: string = meta.full_name || meta.name || user.email?.split('@')[0] || '名無し'
  const initialTab: HubTab = tab === 'list' || tab === 'mine' || tab === 'public' ? tab : 'play'
  const initialMode = MODES.find(m => m.id === play)?.id ?? null

  return (
    <QuizHub
      quizzes={quizzes}
      mySets={((mySets ?? []) as SetRow[]).map(toSet)}
      publicSets={((publicSets ?? []) as SetRow[]).map(toSet)}
      initialGenre={genre ?? null}
      initialTab={initialTab}
      initialMode={initialMode}
      authorName={authorName}
      progress={progress}
      nowMs={getNow()}
    />
  )
}
