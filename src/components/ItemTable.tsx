'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Shelf, Item, SourceType } from '@/types'

const SOURCE_LABELS: Record<SourceType, string> = {
  book: '📖 本', youtube: '▶️ YouTube', web: '🌐 Web', other: '📄 その他',
}
const SOURCE_CLASSES: Record<SourceType, string> = {
  book: 'bg-blue-100 text-blue-800',
  youtube: 'bg-red-100 text-red-800',
  web: 'bg-green-100 text-green-800',
  other: 'bg-gray-100 text-gray-700',
}
const SOURCES: SourceType[] = ['book', 'youtube', 'web', 'other']

export default function ItemTable({ shelf, items }: { shelf: Shelf; items: Item[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [srcType, setSrcType] = useState<SourceType>('book')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [url, setUrl] = useState('')

  async function addItem() {
    if (!title.trim()) return
    await supabase.from('items').insert({
      shelf_id: shelf.id,
      title: title.trim(),
      author: author.trim() || null,
      url: url.trim() || null,
      source_type: srcType,
    })
    setTitle(''); setAuthor(''); setUrl('')
    setShowForm(false)
    router.refresh()
  }

  async function deleteItem(id: string) {
    if (!confirm('このアイテムを削除しますか？')) return
    await supabase.from('items').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-bold text-base">{shelf.name}</span>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600"
        >
          ＋ 追加
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
          <div className="flex gap-1.5 mb-2.5 flex-wrap">
            {SOURCES.map(s => (
              <button
                key={s}
                onClick={() => setSrcType(s)}
                className={`px-3 py-1 rounded-full text-xs border transition-all ${
                  srcType === s ? SOURCE_CLASSES[s] + ' border-transparent' : 'border-gray-200 text-gray-400'
                }`}
              >
                {SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-2 flex-wrap">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル *" className="flex-1 min-w-32 text-sm px-2.5 py-1.5 border border-gray-200 rounded-md outline-none focus:border-blue-400" />
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="著者 / チャンネル名（任意）" className="flex-1 min-w-32 text-sm px-2.5 py-1.5 border border-gray-200 rounded-md outline-none focus:border-blue-400" />
          </div>
          <div className="flex gap-2">
            <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="URL（任意）" className="flex-1 text-sm px-2.5 py-1.5 border border-gray-200 rounded-md outline-none focus:border-blue-400" />
            <button onClick={addItem} className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600">追加</button>
            <button onClick={() => setShowForm(false)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50">キャンセル</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <th className="text-left px-3 py-2.5 w-24">種別</th>
              <th className="text-left px-3 py-2.5">タイトル</th>
              <th className="text-left px-3 py-2.5 w-28">著者/作者</th>
              <th className="text-center px-3 py-2.5 w-14">メモ</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-gray-400 py-8 text-sm">アイテムがありません</td></tr>
            ) : items.map(item => (
              <tr
                key={item.id}
                onClick={() => router.push(`/dashboard/${shelf.id}/${item.id}`)}
                className="cursor-pointer hover:bg-gray-50 border-t border-gray-100"
              >
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SOURCE_CLASSES[item.source_type]}`}>
                    {SOURCE_LABELS[item.source_type]}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-sm">{item.title}</div>
                  {item.url && (
                    <a href={item.url} target="_blank" onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-500 hover:underline">🔗 リンクを開く</a>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-400">{item.author}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full px-2">{item.memo_count}</span>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                    className="text-xs text-red-400 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50"
                  >削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
