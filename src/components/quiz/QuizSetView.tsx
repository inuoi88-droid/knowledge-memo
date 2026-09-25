'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Quiz } from '@/types'
import { useDensity } from '@/lib/density'
import { DIFFICULTY_LEVELS } from '@/lib/quiz'
import { generateRoomCode, roomUrl } from '@/lib/room'
import { btn, card } from '@/lib/ui'
import QuizRow from './QuizRow'
import QuizPlayer from './QuizPlayer'
import DensityToggle from './DensityToggle'
import { DifficultyBadge } from './Difficulty'

export default function QuizSetView({
  set,
  quizzes,
  isOwner,
}: {
  set: { id: string; title: string; description: string | null; authorName: string | null; isPublic: boolean }
  quizzes: Quiz[]
  isOwner: boolean
}) {
  const router = useRouter()
  const density = useDensity()
  const [playing, setPlaying] = useState(false)
  const [showList, setShowList] = useState(isOwner)
  const [copied, setCopied] = useState(false)

  const genres = [...new Set(quizzes.flatMap(q => q.tags))]
  const levelCounts = DIFFICULTY_LEVELS.map(l => ({ l, n: quizzes.filter(q => q.difficulty === l).length })).filter(x => x.n > 0)

  async function copyLink() {
    await navigator.clipboard.writeText(`${location.origin}/quiz/sets/${set.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function togglePublic() {
    await createClient().from('quiz_sets').update({ is_public: !set.isPublic }).eq('id', set.id)
    router.refresh()
  }

  async function removeFromSet(memoId: string) {
    await createClient().from('quiz_set_items').delete().eq('quiz_set_id', set.id).eq('memo_id', memoId)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={`${card} overflow-hidden`}>
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-white">
          <div className="text-xs font-medium uppercase tracking-wider opacity-80">クイズセット</div>
          <h1 className="mt-1 text-2xl font-bold">{set.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-90">
            <span>{quizzes.length}問</span>
            {set.authorName && <span>作成: {set.authorName}</span>}
            {isOwner && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{set.isPublic ? '公開中' : '非公開'}</span>}
          </div>
          {set.description && <p className="mt-3 whitespace-pre-wrap text-sm opacity-90">{set.description}</p>}
        </div>
        <div className="flex flex-col gap-4 p-5">
          {(genres.length > 0 || levelCounts.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {genres.map(g => <span key={g} className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">#{g}</span>)}
                </div>
              )}
              {levelCounts.map(({ l, n }) => (
                <span key={l} className="inline-flex items-center gap-1"><DifficultyBadge level={l} /> {n}問</span>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setPlaying(true)} disabled={quizzes.length === 0} className={`${btn.primary} py-3 text-base`}>
              ▶ ひとりで遊ぶ
            </button>
            <button
              onClick={() => router.push(roomUrl(generateRoomCode(), { setId: set.id }))}
              disabled={quizzes.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-rose-600 disabled:opacity-40"
            >
              ⚡ みんなで早押し
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(set.isPublic || isOwner) && (
              <button onClick={copyLink} className={btn.secondary} disabled={!set.isPublic}>
                {copied ? '✓ コピーしました' : '🔗 共有リンクをコピー'}
              </button>
            )}
            {isOwner && (
              <button onClick={togglePublic} className={btn.ghost}>
                {set.isPublic ? '非公開にする' : '公開する'}
              </button>
            )}
            {isOwner && !set.isPublic && (
              <span className="text-xs text-gray-500">共有するには公開してください（公開するとログインなしで遊べます）</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setShowList(v => !v)} className="text-sm font-medium text-indigo-600 hover:underline">
          {showList ? '▲ 問題一覧を閉じる' : `▼ 問題一覧を見る（${quizzes.length}問）`}
        </button>
        {showList && <DensityToggle />}
      </div>

      {showList && (
        <div className={`${card} divide-y divide-gray-100 overflow-hidden`}>
          {quizzes.map(q => (
            <QuizRow
              key={q.id}
              quiz={q}
              density={density}
              actions={isOwner ? <button onClick={() => removeFromSet(q.id)} className={btn.danger}>外す</button> : undefined}
            />
          ))}
        </div>
      )}

      {playing && <QuizPlayer quizzes={quizzes} title={set.title} onClose={() => setPlaying(false)} />}
    </div>
  )
}
