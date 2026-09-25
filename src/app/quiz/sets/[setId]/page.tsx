import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createClient, getUser } from '@/lib/supabase/server'
import type { Quiz } from '@/types'
import { toQuiz } from '@/lib/quiz'
import QuizSetView from '@/components/quiz/QuizSetView'

const loadSet = cache(async (setId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(setId)) return null
  const supabase = await createClient()
  const [{ data: set }, { data: rows }] = await Promise.all([
    supabase.from('quiz_sets').select('*').eq('id', setId).maybeSingle(),
    supabase
      .from('quiz_set_items')
      .select('position, memos(id, question, answer, explanation, difficulty, tags)')
      .eq('quiz_set_id', setId)
      .order('position'),
  ])
  if (!set) return null
  const quizzes: Quiz[] = (rows ?? [])
    .map(r => r.memos as unknown as Parameters<typeof toQuiz>[0] | null)
    .filter((m): m is Parameters<typeof toQuiz>[0] => !!m)
    .map(toQuiz)
  return { set, quizzes }
})

export async function generateMetadata({ params }: { params: Promise<{ setId: string }> }): Promise<Metadata> {
  const { setId } = await params
  const data = await loadSet(setId)
  if (!data) return { title: 'クイズセット | 知識メモ' }
  return {
    title: `${data.set.title}（${data.quizzes.length}問） | 知識メモ`,
    description: data.set.description ?? `${data.quizzes.length}問のクイズセット`,
  }
}

export default async function QuizSetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  const [data, user] = await Promise.all([loadSet(setId), getUser()])
  if (!data) notFound()

  return (
    <QuizSetView
      set={{
        id: data.set.id,
        title: data.set.title,
        description: data.set.description,
        authorName: data.set.author_name,
        isPublic: data.set.is_public,
      }}
      quizzes={data.quizzes}
      isOwner={!!user && user.id === data.set.user_id}
    />
  )
}
