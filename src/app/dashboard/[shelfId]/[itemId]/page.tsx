import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MemoDetail from '@/components/MemoDetail'
import Breadcrumb from '@/components/Breadcrumb'

export default async function ItemPage({
  params,
}: {
  params: Promise<{ shelfId: string; itemId: string }>
}) {
  const { shelfId, itemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: shelf } = await supabase
    .from('shelves').select('*').eq('id', shelfId).eq('user_id', user!.id).single()
  if (!shelf) notFound()

  const { data: item } = await supabase
    .from('items').select('*').eq('id', itemId).eq('user_id', user!.id).single()
  if (!item) notFound()

  const { data: memos } = await supabase
    .from('memos')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <Breadcrumb shelf={shelf} item={item} />
      <MemoDetail item={item} memos={memos ?? []} />
    </div>
  )
}
