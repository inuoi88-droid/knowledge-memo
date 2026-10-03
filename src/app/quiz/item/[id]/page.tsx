import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { loadSourcePage } from '@/lib/supabase/sourcePage'
import { displayName } from '@/lib/user'
import QuizSourceView from '@/components/quiz/QuizSourceView'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await loadSourcePage('item', id)
  if (!data) return { title: 'クイズ | 知識メモ' }
  return {
    title: `${data.title}（${data.quizzes.length}問） | 知識メモ`,
    description: `「${data.title}」の${data.quizzes.length}問のクイズ`,
  }
}

export default async function ItemQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [data, user] = await Promise.all([loadSourcePage('item', id), getUser()])
  if (!data) notFound()
  return <QuizSourceView data={data} isOwner={!!user && user.id === data.ownerId} loggedIn={!!user} defaultAuthor={displayName(user)} />
}
