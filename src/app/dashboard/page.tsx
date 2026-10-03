import { createClient, getUser } from '@/lib/supabase/server'
import { getNow } from '@/lib/stage'
import ShelfGrid from '@/components/ShelfGrid'
import HomeBanner from '@/components/HomeBanner'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: shelves }, { count: quizCount }, { count: dueCount }] = await Promise.all([
    supabase
      .from('shelves')
      .select('*, items(id, memos(count))')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('memos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('type', 'qa'),
    supabase
      .from('quiz_progress')
      .select('memo_id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .lte('due_at', new Date(getNow()).toISOString()),
  ])

  // カウント整形
  const shelvesWithCount = (shelves ?? []).map(({ items, ...s }) => ({
    ...s,
    item_count: items?.length ?? 0,
    memo_count: (items as { memos: { count: number }[] }[] | null)?.reduce((acc, i) => acc + (i.memos?.[0]?.count ?? 0), 0) ?? 0,
  }))

  return (
    <div className="flex flex-col gap-6">
      <HomeBanner quizCount={quizCount ?? 0} dueCount={dueCount ?? 0} />
      <ShelfGrid shelves={shelvesWithCount} />
    </div>
  )
}
