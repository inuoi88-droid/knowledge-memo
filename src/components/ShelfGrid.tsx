'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Shelf } from '@/types'

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
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">本棚</span>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors"
        >
          ＋ 本棚を追加
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 p-3 mb-4 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addShelf()}
            placeholder="本棚の名前（例：ビジネス、YouTube）"
            className="flex-1 text-sm px-3 py-1.5 border border-gray-200 outline-none focus:border-gray-400"
          />
          <button onClick={addShelf} className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors">追加</button>
          <button onClick={() => setShowForm(false)} className="text-xs border border-gray-200 px-3 py-1.5 hover:bg-gray-50 transition-colors">キャンセル</button>
        </div>
      )}

      {shelves.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">本棚がありません。「＋ 本棚を追加」から作成してください。</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {shelves.map(s => editingId === s.id ? (
            <div key={s.id} className="bg-white border border-gray-400 p-3 flex flex-col gap-2">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEdit(s.id)}
                className="text-sm px-2 py-1 border border-gray-200 outline-none focus:border-gray-400"
              />
              <div className="flex gap-1.5">
                <button onClick={() => saveEdit(s.id)} className="text-xs bg-gray-900 text-white px-2.5 py-1 hover:bg-gray-700 transition-colors">保存</button>
                <button onClick={() => setEditingId(null)} className="text-xs border border-gray-200 px-2.5 py-1 hover:bg-gray-50 transition-colors">キャンセル</button>
              </div>
            </div>
          ) : (
            <div
              key={s.id}
              onClick={() => router.push(`/dashboard/${s.id}`)}
              className="bg-white border border-gray-200 p-4 cursor-pointer hover:border-gray-400 transition-colors relative group"
            >
              <div className="absolute top-2 right-2 flex gap-2 text-gray-200 group-hover:text-gray-400">
                <button
                  onClick={e => { e.stopPropagation(); startEdit(s) }}
                  className="hover:!text-gray-700 text-xs leading-none"
                >✎</button>
                <button
                  onClick={e => { e.stopPropagation(); deleteShelf(s.id) }}
                  className="hover:!text-red-400 text-sm leading-none"
                >✕</button>
              </div>
              <div className="font-semibold text-sm mb-1 pr-8">{s.name}</div>
              <div className="text-xs text-gray-400">{s.item_count}件 · メモ {s.memo_count}件</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
