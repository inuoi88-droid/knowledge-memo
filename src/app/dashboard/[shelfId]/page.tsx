import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ItemTable from '@/components/ItemTable'
import Breadcrumb from '@/components/Breadcrumb'

export default async function ShelfPage({ params }: { params: Promise<{ shelfId: string }> }) {
  const { shelfId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: shelf } = await supabase
    .from('shelves')
    .select('*')
    .eq('id', shelfId)
    .eq('user_id', user!.id)
    .single()

  if (!shelf) notFound()

  const { data: items } = await supabase
    .from('items')
    .select('*, memos(id)')
    .eq('shelf_id', shelfId)
    .order('created_at', { ascending: false })

  const itemsWithCount = (items ?? []).map(i => ({
    ...i,
    memo_count: i.memos?.length ?? 0,
  }))

  return (
    <div>
      <Breadcrumb shelf={shelf} />
      <ItemTable shelf={shelf} items={itemsWithCount} />
    </div>
  )
}
