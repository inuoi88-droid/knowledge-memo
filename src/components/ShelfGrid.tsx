'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Shelf } from '@/types'
import { btn, card, input } from '@/lib/ui'

export default function ShelfGrid({ shelves }: { shelves: Shelf[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function addShelf() {
    if (!name.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('shelves').insert({ name: name.trim(), user_id: user.id })
    if (!error) {
      setName('')
      setShowForm(false)
      router.refresh()
    }
  }

  async function deleteShelf(id: string) {
    if (!confirm('この本棚を削除しますか？（中のアイテムもすべて削除されます）')) return
    await supabase.from('shelves').delete().eq('id', id)
    router.refresh()
  }

  function startEdit(s: Shelf) {
    setEditingId(s.id)
    setEditName(s.name)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    const { error } = await supabase.from('shelves').update({ name: editName.trim() }).eq('id', id)
    if (!error) {
      setEditingId(null)
      router.refresh()
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">本棚</h2>
        <button onClick={() => setShowForm(v => !v)} className={btn.primary}>＋ 本棚を追加</button>
      </div>

      {showForm && (
        <div className={`${card} mb-4 flex flex-wrap gap-2 p-3`}>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addShelf()}
            placeholder="本棚の名前（例：ビジネス、YouTube）"
            className={`${input} min-w-48 flex-1`}
          />
          <button onClick={addShelf} className={btn.primary}>追加</button>
          <button onClick={() => setShowForm(false)} className={btn.secondary}>キャンセル</button>
        </div>
      )}

      {shelves.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">本棚がありません。「＋ 本棚を追加」から作成してください。</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {shelves.map(s => editingId === s.id ? (
            <div key={s.id} className={`${card} flex flex-col gap-2 border-indigo-300 p-3`}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit(s.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className={input}
              />
              <div className="flex gap-1.5">
                <button onClick={() => saveEdit(s.id)} className={btn.small}>保存</button>
                <button onClick={() => setEditingId(null)} className={btn.ghost}>キャンセル</button>
              </div>
            </div>
          ) : (
            <div key={s.id} className={`${card} group relative transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md`}>
              <Link href={`/dashboard/${s.id}`} className="block p-4">
                <div className="mb-3 text-2xl">📚</div>
                <div className="pr-12 font-semibold text-gray-900">{s.name}</div>
                <div className="mt-1 text-xs text-gray-500">{s.item_count}冊 · メモ {s.memo_count}件</div>
              </Link>
              <div className="absolute right-2 top-2 flex gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                <button onClick={() => startEdit(s)} className={btn.ghost} title="名前を変更">✎</button>
                <button onClick={() => deleteShelf(s.id)} className={btn.danger} title="削除">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
