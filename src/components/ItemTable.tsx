'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Shelf, Item, SourceType } from '@/types'

const SOURCE_LABELS: Record<SourceType, string> = {
  book: '本', youtube: 'YouTube', web: 'Web', other: 'その他',
}
const SOURCE_CLASSES: Record<SourceType, string> = {
  book: 'bg-blue-50 text-blue-700 border-blue-200',
  youtube: 'bg-red-50 text-red-700 border-red-200',
  web: 'bg-green-50 text-green-700 border-green-200',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
}
const SOURCES: SourceType[] = ['book', 'youtube', 'web', 'other']

export default function ItemTable({ shelf, items, allShelves }: { shelf: Shelf; items: Item[]; allShelves: Shelf[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [srcType, setSrcType] = useState<SourceType>('book')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [url, setUrl] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSrcType, setEditSrcType] = useState<SourceType>('book')
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editUrl, setEditUrl] = useState('')

  async function addItem() {
    if (!title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('items').insert({
      shelf_id: shelf.id,
      user_id: user.id,
      title: title.trim(),
      author: author.trim() || null,
      url: url.trim() || null,
      source_type: srcType,
    })
    if (!error) {
      setTitle(''); setAuthor(''); setUrl('')
      setShowForm(false)
      router.refresh()
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('このアイテムを削除しますか？')) return
    await supabase.from('items').delete().eq('id', id)
    router.refresh()
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditSrcType(item.source_type)
    setEditTitle(item.title)
    setEditAuthor(item.author ?? '')
    setEditUrl(item.url ?? '')
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return
    const { error } = await supabase.from('items').update({
      title: editTitle.trim(),
      author: editAuthor.trim() || null,
      url: editUrl.trim() || null,
      source_type: editSrcType,
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
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-semibold text-base">{shelf.name}</span>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors"
        >
          ＋ 追加
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 p-3 mb-4">
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {SOURCES.map(s => (
              <button
                key={s}
                onClick={() => setSrcType(s)}
                className={`px-3 py-1 text-xs border transition-colors ${
                  srcType === s ? SOURCE_CLASSES[s] : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-2 flex-wrap">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル *" className="flex-1 min-w-32 text-sm px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400" />
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="著者 / チャンネル名（任意）" className="flex-1 min-w-32 text-sm px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400" />
          </div>
          <div className="flex gap-2">
            <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="URL（任意）" className="flex-1 text-sm px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400" />
            <button onClick={addItem} className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors">追加</button>
            <button onClick={() => setShowForm(false)} className="text-xs border border-gray-200 px-3 py-1.5 hover:bg-gray-50 transition-colors">キャンセル</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-200">
              <th className="text-left px-4 py-2.5 w-24">種別</th>
              <th className="text-left px-4 py-2.5">タイトル</th>
              <th className="text-left px-4 py-2.5 w-28 hidden sm:table-cell">著者/作者</th>
              <th className="text-center px-4 py-2.5 w-14">メモ</th>
              <th className="w-44"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-gray-400 py-10 text-sm">アイテムがありません</td></tr>
            ) : items.map(item => editingId === item.id ? (
              <tr key={item.id} className="border-t border-gray-100 bg-gray-50">
                <td colSpan={5} className="px-4 py-3">
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {SOURCES.map(s => (
                      <button
                        key={s}
                        onClick={() => setEditSrcType(s)}
                        className={`px-3 py-1 text-xs border transition-colors ${
                          editSrcType === s ? SOURCE_CLASSES[s] : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {SOURCE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="タイトル *" className="flex-1 min-w-32 text-sm px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400" />
                    <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} placeholder="著者 / チャンネル名（任意）" className="flex-1 min-w-32 text-sm px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400" />
                  </div>
                  <div className="flex gap-2">
                    <input value={editUrl} onChange={e => setEditUrl(e.target.value)} type="url" placeholder="URL（任意）" className="flex-1 text-sm px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400" />
                    <button onClick={() => saveEdit(item.id)} className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors">保存</button>
                    <button onClick={() => setEditingId(null)} className="text-xs border border-gray-200 px-3 py-1.5 hover:bg-gray-50 transition-colors">キャンセル</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={item.id}
                onClick={() => router.push(`/dashboard/${shelf.id}/${item.id}`)}
                className="cursor-pointer hover:bg-gray-50 border-t border-gray-100 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 border font-medium ${SOURCE_CLASSES[item.source_type]}`}>
                    {SOURCE_LABELS[item.source_type]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm">{item.title}</div>
                  {item.url && (
                    <a href={item.url} target="_blank" onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-500 hover:underline">リンクを開く</a>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell">{item.author}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5">{item.memo_count}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {allShelves.length > 1 && (
                      <select
                        value={shelf.id}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); moveItem(item.id, e.target.value) }}
                        className="text-xs border border-gray-200 px-1 py-0.5 outline-none focus:border-gray-400 bg-white max-w-20"
                        title="別の本棚へ移動"
                      >
                        {allShelves.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(item) }}
                      className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 hover:bg-gray-100 transition-colors"
                    >編集</button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                      className="text-xs text-red-400 border border-red-200 px-2 py-0.5 hover:bg-red-50 transition-colors"
                    >削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
