import { notFound } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { uniqueTags } from '@/lib/quiz'
import { displayName } from '@/lib/user'
import MemoDetail from '@/components/MemoDetail'
import Breadcrumb from '@/components/Breadcrumb'
import type { Memo } from '@/types'

export default async function ItemPage({
  params,
}: {
  params: Promise<{ shelfId: string; itemId: string }>
}) {
  const { shelfId, itemId } = await params
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: shelf }, { data: item }, memos] = await Promise.all([
    supabase.from('shelves').select('*').eq('id', shelfId).eq('user_id', user!.id).single(),
    supabase.from('items').select('*').eq('id', itemId).eq('user_id', user!.id).single(),
    // 新しく追加したものが上。一度に貼り付けた問題は表の上から順
    fetchAll<Memo>((from, to) =>
      supabase
        .from('memos')
        .select('*', { count: 'exact' })
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .order('position')
        .range(from, to),
    ),
  ])

  if (!shelf) notFound()
  if (!item) notFound()

  return (
    <div>
      <Breadcrumb shelf={shelf} item={item} />
      <MemoDetail
        item={item}
        shelf={shelf}
        memos={memos.map(m => ({ ...m, tags: uniqueTags(m.tags) }))}
        defaultAuthor={displayName(user)}
      />
    </div>
  )
}
