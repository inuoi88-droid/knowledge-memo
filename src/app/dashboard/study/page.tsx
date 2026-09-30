import type { Metadata } from 'next'
import { createClient, getUser } from '@/lib/supabase/server'
import { fetchMyProgress, fetchMyQuizzes } from '@/lib/supabase/queries'
import { getNow } from '@/lib/stage'
import StudyHub from '@/components/study/StudyHub'
import type { PlaySessionRecord } from '@/types'

export const metadata: Metadata = { title: '勉強 | 知識メモ' }

export default async function StudyPage() {
  const supabase = await createClient()
  const user = (await getUser())!

  const [quizzes, progress, { data: sessions }] = await Promise.all([
    fetchMyQuizzes(supabase, user.id),
    fetchMyProgress(supabase, user.id),
    supabase
      .from('play_sessions')
      .select('id, title, mode, rule, total, correct, max_combo, duration_ms, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <StudyHub
      quizzes={quizzes}
      progress={progress}
      sessions={(sessions ?? []) as PlaySessionRecord[]}
      nowMs={getNow()}
    />
  )
}
