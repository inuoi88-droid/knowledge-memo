import { createClient, getUser } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { countTags } from '@/lib/quiz'
import { getNow } from '@/lib/stage'
import ShelfGrid from '@/components/ShelfGrid'
import TagCloud from '@/components/TagCloud'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: shelves }, memos, { count: dueCount }] = await Promise.all([
    supabase
      .from('shelves')
      .select('*, items(id, memos(id))')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    fetchAll((from, to) =>
      supabase
        .from('memos')
        .select('tags', { count: 'exact' })
        .eq('user_id', user!.id)
        .eq('type', 'qa')
        .order('id')
        .range(from, to),
    ),
    supabase
      .from('quiz_progress')
      .select('memo_id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .lte('due_at', new Date(getNow()).toISOString()),
  ])

  const genres = countTags(memos)

  // カウント整形
  const shelvesWithCount = (shelves ?? []).map(s => ({
    ...s,
    item_count: s.items?.length ?? 0,
    memo_count: s.items?.reduce((acc: number, i: { memos: unknown[] }) => acc + (i.memos?.length ?? 0), 0) ?? 0,
  }))

  return (
    <div className="flex flex-col gap-6">
      <TagCloud genres={genres} quizCount={memos.length} dueCount={dueCount ?? 0} />
      <ShelfGrid shelves={shelvesWithCount} />
    </div>
  )
}
