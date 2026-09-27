'use client'

import { useState } from 'react'
import type { TagCount } from '@/lib/quiz'
import { chip } from '@/lib/ui'

const MORE_STEP = 30

// タグが多くても重くならないよう、多い順に上位だけ表示し、残りは検索か「もっと見る」で出す
export default function TagPicker({
  tags,
  selected,
  onToggle,
  initial = 12,
}: {
  tags: TagCount[]
  selected: string[]
  onToggle: (tag: string) => void
  initial?: number
}) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(initial)

  const q = query.normalize('NFKC').trim().toLowerCase()
  const matches = q ? tags.filter(t => t.name.normalize('NFKC').toLowerCase().includes(q)) : tags
  const candidates = matches.filter(t => !selected.includes(t.name))
  const shown = candidates.slice(0, limit)
  const countOf = (name: string) => tags.find(t => t.name === name)?.count

  if (tags.length === 0) return <span className="text-xs text-gray-400">タグはまだありません</span>

  return (
    <div className="flex flex-col gap-2">
      {tags.length > initial && (
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setLimit(initial) }}
          placeholder={`🔍 ${tags.length}件のタグから検索`}
          className="w-full max-w-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs outline-none placeholder:text-gray-400 focus:border-indigo-400"
        />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map(name => (
          <button key={name} type="button" onClick={() => onToggle(name)} className={chip(true)} title="クリックで解除">
            #{name} {countOf(name) !== undefined && <span className="opacity-70">{countOf(name)}</span>} ✕
          </button>
        ))}
        {shown.map(t => (
          <button key={t.name} type="button" onClick={() => onToggle(t.name)} className={chip(false)}>
            #{t.name} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
        {q && candidates.length === 0 && <span className="text-xs text-gray-400">「{query.trim()}」に一致するタグはありません</span>}
        {candidates.length > limit && (
          <button type="button" onClick={() => setLimit(l => l + MORE_STEP)} className="text-xs font-medium text-indigo-600 hover:underline">
            + もっと見る（残り{candidates.length - limit}件）
          </button>
        )}
        {limit > initial && (
          <button type="button" onClick={() => setLimit(initial)} className="text-xs text-gray-400 hover:text-gray-600">閉じる</button>
        )}
      </div>
    </div>
  )
}
