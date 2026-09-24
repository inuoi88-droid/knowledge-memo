import { notFound } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import MemoDetail from '@/components/MemoDetail'
import Breadcrumb from '@/components/Breadcrumb'

export default async function ItemPage({
  params,
}: {
  params: Promise<{ shelfId: string; itemId: string }>
}) {
  const { shelfId, itemId } = await params
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: shelf }, { data: item }, { data: memos }] = await Promise.all([
    supabase.from('shelves').select('*').eq('id', shelfId).eq('user_id', user!.id).single(),
    supabase.from('items').select('*').eq('id', itemId).eq('user_id', user!.id).single(),
    supabase
      .from('memos')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false }),
  ])

  if (!shelf) notFound()
  if (!item) notFound()

  return (
    <div>
      <Breadcrumb shelf={shelf} item={item} />
      <MemoDetail item={item} memos={memos ?? []} />
    </div>
  )
}
