import Link from 'next/link'
import { MODES } from '@/lib/play'

export default function HomeBanner({ quizCount, dueCount }: { quizCount: number; dueCount: number }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-widest opacity-80">🎯 クイズ</div>
          <div className="text-4xl font-black leading-tight">{quizCount}<span className="ml-1 text-base font-bold opacity-80">問</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/study"
            className="rounded-2xl bg-white px-5 py-3 text-lg font-black text-indigo-700 shadow-lg transition-transform hover:scale-105"
          >
            📖 今日の学習
            {dueCount > 0 && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-sm text-indigo-950">復習 {dueCount}問</span>}
          </Link>
          <Link href="/dashboard/quiz" className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-black ring-1 ring-white/30 transition-colors hover:bg-white/25">
            🎮 あそぶ
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
  )
}
