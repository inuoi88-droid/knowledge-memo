import type { Metadata } from 'next'
import { createClient, getUser } from '@/lib/supabase/server'
import { fetchMyProgress, fetchMyQuizzes, fetchMyShelfTree } from '@/lib/supabase/queries'
import { STUDY_SETTINGS_COLUMNS, toStudySettings } from '@/lib/progress'
import { scopeFromParams } from '@/lib/scope'
import { getNow } from '@/lib/stage'
import StudyHub from '@/components/study/StudyHub'
import type { PlaySessionRecord, StudySettingsRow } from '@/types'

export const metadata: Metadata = { title: '学習 | 知識メモ' }

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ shelf?: string; item?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const user = (await getUser())!

  const [quizzes, progress, tree, { data: sessions }, { data: settingsRow }] = await Promise.all([
    fetchMyQuizzes(supabase, user.id),
    fetchMyProgress(supabase, user.id),
    fetchMyShelfTree(supabase, user.id),
    supabase
      .from('play_sessions')
      .select('id, title, mode, rule, total, correct, max_combo, duration_ms, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('study_settings')
      .select(STUDY_SETTINGS_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return (
    <StudyHub
      quizzes={quizzes}
      progress={progress}
      sessions={(sessions ?? []) as PlaySessionRecord[]}
      nowMs={getNow()}
      settings={toStudySettings(settingsRow as StudySettingsRow | null)}
      tree={tree}
      initialScope={scopeFromParams(sp)}
    />
  )
}
