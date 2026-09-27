'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TagCount } from '@/lib/quiz'
import { card } from '@/lib/ui'
import TagPicker from './TagPicker'

export default function TagCloud({ genres, quizCount }: { genres: TagCount[]; quizCount: number }) {
  const router = useRouter()
  return (
    <div className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-start`}>
      <Link
        href="/dashboard/quiz"
        className="flex shrink-0 items-center gap-3 rounded-lg bg-indigo-600 px-4 py-3 text-white shadow-sm transition-colors hover:bg-indigo-700"
      >
        <span className="text-2xl">🎯</span>
        <span>
          <span className="block text-xs opacity-80">クイズ</span>
          <span className="text-lg font-bold">{quizCount}<span className="ml-0.5 text-xs font-normal">問</span></span>
        </span>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-xs font-medium text-gray-500">ジャンルから遊ぶ</div>
        {genres.length === 0 ? (
          <span className="text-xs text-gray-400">クイズにジャンルを付けると、ここに表示されます</span>
        ) : (
          <TagPicker
            tags={genres}
            selected={[]}
            onToggle={g => router.push(`/dashboard/quiz?genre=${encodeURIComponent(g)}`)}
          />
        )}
      </div>
    </div>
  )
}
