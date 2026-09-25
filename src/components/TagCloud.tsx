import Link from 'next/link'
import { card } from '@/lib/ui'

export default function TagCloud({ genres, quizCount }: { genres: { name: string; count: number }[]; quizCount: number }) {
  return (
    <div className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
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
          <div className="flex flex-wrap gap-1.5">
            {genres.map(g => (
              <Link
                key={g.name}
                href={`/dashboard/quiz?genre=${encodeURIComponent(g.name)}`}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                #{g.name}
                <span className="text-indigo-400">{g.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
