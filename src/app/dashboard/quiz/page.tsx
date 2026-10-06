import { createClient, getUser } from '@/lib/supabase/server'
import { fetchMyProgress, fetchMyQuizMeta, fetchMyShelfTree, fetchPublicSources } from '@/lib/supabase/queries'
import { scopeFromParams } from '@/lib/scope'
import { packProgress, packQuizzes } from '@/lib/quizPack'
import { getNow } from '@/lib/stage'
import QuizHub, { type HubTab } from '@/components/quiz/QuizHub'
import { MODES } from '@/lib/play'

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; tab?: string; play?: string; shelf?: string; item?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const user = (await getUser())!

  const [quizzes, progress, tree, publicSources] = await Promise.all([
    fetchMyQuizMeta(supabase, user.id),
    fetchMyProgress(supabase, user.id),
    fetchMyShelfTree(supabase, user.id),
    fetchPublicSources(supabase),
  ])

  const initialTab: HubTab = sp.tab === 'list' || sp.tab === 'public' ? sp.tab : 'play'
  const initialMode = MODES.find(m => m.id === sp.play)?.id ?? null

  return (
    <QuizHub
      quizzes={packQuizzes(quizzes)}
      tree={tree}
      publicSources={publicSources}
      initialScope={scopeFromParams(sp)}
      initialGenre={sp.genre ?? null}
      initialTab={initialTab}
      initialMode={initialMode}
      progress={packProgress(progress)}
      nowMs={getNow()}
    />
  )
}
