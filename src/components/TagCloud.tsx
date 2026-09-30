'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TagCount } from '@/lib/quiz'
import { MODES } from '@/lib/play'
import { card } from '@/lib/ui'
import TagPicker from './TagPicker'

export default function TagCloud({ genres, quizCount, dueCount }: { genres: TagCount[]; quizCount: number; dueCount: number }) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-widest opacity-80">🎯 クイズ</div>
            <div className="text-4xl font-black leading-tight">{quizCount}<span className="ml-1 text-base font-bold opacity-80">問</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/study"
              className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-black ring-1 ring-white/30 transition-colors hover:bg-white/25"
              title="忘れかけた頃の問題を復習"
            >
              🔁 今日の復習 {dueCount > 0 ? <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-indigo-950">{dueCount}問</span> : <span className="ml-1 opacity-80">なし</span>}
            </Link>
            <Link href="/dashboard/quiz" className="rounded-2xl bg-white px-5 py-3 text-lg font-black text-indigo-700 shadow-lg transition-transform hover:scale-105">
              ▶ あそぶ
            </Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MODES.map(m => (
            <Link
              key={m.id}
              href={`/dashboard/quiz?play=${m.id}`}
              className="flex flex-col items-center gap-0.5 rounded-2xl bg-white/15 px-1 py-2 text-center transition-colors hover:bg-white/25"
            >
              <span className="text-xl">{m.icon}</span>
              <span className="text-xs font-bold">{m.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {genres.length > 0 && (
        <div className={`${card} p-4`}>
          <div className="mb-2 text-xs font-bold text-gray-500">ジャンルから遊ぶ</div>
          <TagPicker
            tags={genres}
            selected={[]}
            onToggle={g => router.push(`/dashboard/quiz?genre=${encodeURIComponent(g)}`)}
          />
        </div>
      )}
    </div>
  )
}
