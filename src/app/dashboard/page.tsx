import { createClient, getUser } from '@/lib/supabase/server'
import ShelfGrid from '@/components/ShelfGrid'
import TagCloud from '@/components/TagCloud'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: shelves }, { data: memos }] = await Promise.all([
    supabase
      .from('shelves')
      .select('*, items(id, memos(id))')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('memos')
      .select('tags')
      .eq('user_id', user!.id)
      .eq('type', 'qa'),
  ])

  const genreCounts = new Map<string, number>()
  for (const m of memos ?? []) {
    for (const t of m.tags ?? []) genreCounts.set(t, (genreCounts.get(t) ?? 0) + 1)
  }
  const genres = [...genreCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  // カウント整形
  const shelvesWithCount = (shelves ?? []).map(s => ({
    ...s,
    item_count: s.items?.length ?? 0,
    memo_count: s.items?.reduce((acc: number, i: { memos: unknown[] }) => acc + (i.memos?.length ?? 0), 0) ?? 0,
  }))

  return (
    <div className="flex flex-col gap-6">
      <TagCloud genres={genres} quizCount={memos?.length ?? 0} />
      <ShelfGrid shelves={shelvesWithCount} />
    </div>
  )
}
