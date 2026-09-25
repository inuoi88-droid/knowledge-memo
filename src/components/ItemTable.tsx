'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Shelf, Item, SourceType } from '@/types'
import { btn, card, input } from '@/lib/ui'

const SOURCE_LABELS: Record<SourceType, string> = {
  book: '本', youtube: 'YouTube', web: 'Web', other: 'その他',
}
const SOURCE_ICONS: Record<SourceType, string> = {
  book: '📕', youtube: '▶️', web: '🌐', other: '📎',
}
const SOURCE_CLASSES: Record<SourceType, string> = {
  book: 'bg-blue-50 text-blue-700 border-blue-200',
  youtube: 'bg-red-50 text-red-700 border-red-200',
  web: 'bg-green-50 text-green-700 border-green-200',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
}
const SOURCES: SourceType[] = ['book', 'youtube', 'web', 'other']

interface Fields { srcType: SourceType; title: string; author: string; url: string }
const EMPTY: Fields = { srcType: 'book', title: '', author: '', url: '' }

function ItemFields({ value, onChange, onSubmit, onCancel, submitLabel }: {
  value: Fields
  onChange: (v: Fields) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {SOURCES.map(s => (
          <button key={s} type="button" onClick={() => onChange({ ...value, srcType: s })}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${value.srcType === s ? SOURCE_CLASSES[s] : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
            {SOURCE_ICONS[s]} {SOURCE_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input autoFocus value={value.title} onChange={e => onChange({ ...value, title: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && onSubmit()} placeholder="タイトル *" className={input} />
        <input value={value.author} onChange={e => onChange({ ...value, author: e.target.value })}
          placeholder="著者 / チャンネル名（任意）" className={input} />
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={value.url} onChange={e => onChange({ ...value, url: e.target.value })} type="url"
          placeholder="URL（任意）" className={`${input} min-w-48 flex-1`} />
        <button onClick={onSubmit} className={btn.primary}>{submitLabel}</button>
        <button onClick={onCancel} className={btn.secondary}>キャンセル</button>
      </div>
    </div>
  )
}

export default function ItemTable({ shelf, items, allShelves }: { shelf: Shelf; items: Item[]; allShelves: Shelf[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Fields>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<Fields>(EMPTY)

  async function addItem() {
    if (!draft.title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('items').insert({
      shelf_id: shelf.id,
      user_id: user.id,
      title: draft.title.trim(),
      author: draft.author.trim() || null,
      url: draft.url.trim() || null,
      source_type: draft.srcType,
    })
    if (!error) {
      setDraft(EMPTY)
      setShowForm(false)
      router.refresh()
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('このアイテムを削除しますか？（中のメモもすべて削除されます）')) return
    await supabase.from('items').delete().eq('id', id)
    router.refresh()
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEdit({ srcType: item.source_type, title: item.title, author: item.author ?? '', url: item.url ?? '' })
  }

  async function saveEdit(id: string) {
    if (!edit.title.trim()) return
    const { error } = await supabase.from('items').update({
      title: edit.title.trim(),
      author: edit.author.trim() || null,
      url: edit.url.trim() || null,
      source_type: edit.srcType,
    }).eq('id', id)
    if (!error) {
      setEditingId(null)
      router.refresh()
    }
  }

  async function moveItem(id: string, newShelfId: string) {
    if (newShelfId === shelf.id) return
    await supabase.from('items').update({ shelf_id: newShelfId }).eq('id', id)
    router.refresh()
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">{shelf.name}</h1>
        <button onClick={() => setShowForm(v => !v)} className={btn.primary}>＋ アイテムを追加</button>
      </div>

      {showForm && (
        <div className={`${card} mb-4 p-4`}>
          <ItemFields value={draft} onChange={setDraft} onSubmit={addItem} onCancel={() => setShowForm(false)} submitLabel="追加" />
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">アイテムがありません。本や動画を追加しましょう。</p>
      ) : (
        <ul className={`${card} divide-y divide-gray-100 overflow-hidden`}>
          {items.map(item => editingId === item.id ? (
            <li key={item.id} className="bg-indigo-50/40 p-4">
              <ItemFields value={edit} onChange={setEdit} onSubmit={() => saveEdit(item.id)} onCancel={() => setEditingId(null)} submitLabel="保存" />
            </li>
          ) : (
            <li key={item.id} className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-gray-50">
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${SOURCE_CLASSES[item.source_type]}`}>
                {SOURCE_ICONS[item.source_type]} {SOURCE_LABELS[item.source_type]}
              </span>
              <Link href={`/dashboard/${shelf.id}/${item.id}`} className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900 group-hover:text-indigo-700">{item.title}</div>
                {item.author && <div className="truncate text-xs text-gray-500">{item.author}</div>}
              </Link>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">リンク ↗</a>
              )}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600" title="メモ数">
                {item.memo_count}
              </span>
              <div className="flex items-center gap-0.5">
                {allShelves.length > 1 && (
                  <select
                    value={shelf.id}
                    onChange={e => moveItem(item.id, e.target.value)}
                    className="max-w-28 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-600 outline-none focus:border-indigo-400"
                    title="別の本棚へ移動"
                  >
                    {allShelves.map(s => (
                      <option key={s.id} value={s.id}>{s.id === shelf.id ? `📚 ${s.name}` : `→ ${s.name}`}</option>
                    ))}
                  </select>
                )}
                <button onClick={() => startEdit(item)} className={btn.ghost}>編集</button>
                <button onClick={() => deleteItem(item.id)} className={btn.danger}>削除</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
