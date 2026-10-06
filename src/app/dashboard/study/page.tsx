import type { Metadata } from 'next'
import { createClient, getUser } from '@/lib/supabase/server'
import { fetchMyProgress, fetchMyQuizMeta, fetchMyShelfTree } from '@/lib/supabase/queries'
import { STUDY_SETTINGS_COLUMNS, toStudySettings } from '@/lib/progress'
import { REMINDER_COLUMNS, toReminderSettings } from '@/lib/reminders'
import { scopeFromParams } from '@/lib/scope'
import { packProgress, packQuizzes } from '@/lib/quizPack'
import { getNow } from '@/lib/stage'
import StudyHub from '@/components/study/StudyHub'
import type { PlaySessionRecord, StudySettingsRow } from '@/types'

export const metadata: Metadata = { title: '学習 | 知識メモ' }

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ shelf?: string; item?: string; notify?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const user = (await getUser())!

  const [quizzes, progress, tree, { data: sessions }, { data: settingsRow }, { data: reminderRow }, { count: deviceCount }] = await Promise.all([
    fetchMyQuizMeta(supabase, user.id),
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
    supabase
      .from('reminder_settings')
      .select(REMINDER_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  return (
    <StudyHub
      key={sp.notify ?? ''}
      quizzes={packQuizzes(quizzes)}
      progress={packProgress(progress)}
      sessions={(sessions ?? []) as PlaySessionRecord[]}
      nowMs={getNow()}
      settings={toStudySettings(settingsRow as StudySettingsRow | null)}
      tree={tree}
      initialScope={scopeFromParams(sp)}
      reminder={{ settings: toReminderSettings(reminderRow), deviceCount: deviceCount ?? 0, email: user.email ?? null }}
      initialNotify={sp.notify === '1'}
    />
  )
}
