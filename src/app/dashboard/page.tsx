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
    // タグ全収集
    supabase
      .from('memos')
      .select('tags')
      .eq('user_id', user!.id),
  ])

  const allTags = [...new Set((memos ?? []).flatMap(m => m.tags ?? []))].sort()

  // カウント整形
  const shelvesWithCount = (shelves ?? []).map(s => ({
    ...s,
    item_count: s.items?.length ?? 0,
    memo_count: s.items?.reduce((acc: number, i: { memos: unknown[] }) => acc + (i.memos?.length ?? 0), 0) ?? 0,
  }))

  return (
    <div>
      <TagCloud tags={allTags} />
      <ShelfGrid shelves={shelvesWithCount} />
    </div>
  )
}
