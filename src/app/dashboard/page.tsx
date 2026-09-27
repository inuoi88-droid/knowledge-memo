import { createClient, getUser } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { countTags } from '@/lib/quiz'
import ShelfGrid from '@/components/ShelfGrid'
import TagCloud from '@/components/TagCloud'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: shelves }, memos] = await Promise.all([
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
      <TagCloud genres={genres} quizCount={memos.length} />
      <ShelfGrid shelves={shelvesWithCount} />
    </div>
  )
}
