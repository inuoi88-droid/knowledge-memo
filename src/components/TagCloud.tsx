'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TagCloud({ tags }: { tags: string[] }) {
  const router = useRouter()
  const [active, setActive] = useState<string | null>(null)

  // タグクリック → 将来的にタグ横断検索ページへ遷移する設計
  function toggle(tag: string) {
    setActive(t => t === tag ? null : tag)
    router.push(`/dashboard?tag=${encodeURIComponent(tag)}`)
  }

  if (tags.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-5">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">タグで横断検索</div>
        <span className="text-xs text-gray-400">メモにタグを付けると、ここに表示されます</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-5">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">タグで横断検索</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span
            key={t}
            onClick={() => toggle(t)}
            className={`text-xs px-2.5 py-0.5 rounded-full border cursor-pointer transition-all ${
              t === active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  )
}
