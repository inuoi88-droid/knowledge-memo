'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDensity } from '@/lib/density'
import { DIFFICULTY_LEVELS, countTags } from '@/lib/quiz'
import { generateRoomCode, roomUrl } from '@/lib/room'
import type { SourcePageData } from '@/lib/supabase/sourcePage'
import { btn, card, chip } from '@/lib/ui'
import PublishButton from '@/components/PublishButton'
import QuizRow from './QuizRow'
import QuizStage from './QuizStage'
import DensityToggle from './DensityToggle'
import { DifficultyBadge } from './Difficulty'

export default function QuizSourceView({
  data,
  isOwner,
  loggedIn,
  defaultAuthor,
}: {
  data: SourcePageData
  isOwner: boolean
  loggedIn: boolean
  defaultAuthor: string
}) {
  const router = useRouter()
  const density = useDensity()
  const [itemId, setItemId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [showList, setShowList] = useState(false)

  const quizzes = itemId ? data.quizzes.filter(q => q.item_id === itemId) : data.quizzes
  const itemTitle = data.items.find(i => i.id === itemId)?.title
  const playTitle = itemTitle ? `${data.title}：${itemTitle}` : data.title
  const allGenres = countTags(quizzes)
  const genres = allGenres.slice(0, 10).map(g => g.name)
  const moreGenres = allGenres.length - genres.length
  const levelCounts = DIFFICULTY_LEVELS.map(l => ({ l, n: quizzes.filter(q => q.difficulty === l).length })).filter(x => x.n > 0)
  const roomSource = itemId ? { kind: 'item' as const, id: itemId } : data.source

  return (
    <div className="flex flex-col gap-5">
      <div className={`${card} overflow-hidden`}>
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-white">
          <div className="text-xs font-medium tracking-wider opacity-80">{data.source.kind === 'shelf' ? '📚 本棚' : '📕 アイテム'}のクイズ</div>
          <h1 className="mt-1 text-2xl font-bold">{data.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-90">
            <span>{data.quizzes.length}問</span>
            {data.subtitle && <span>{data.subtitle}</span>}
            {data.authorName && data.isPublic && <span>公開: {data.authorName}</span>}
            {isOwner && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{data.isPublic ? '公開中' : '非公開（あなただけ見られます）'}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {data.items.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-gray-500">アイテム</span>
              <button onClick={() => setItemId(null)} className={chip(itemId === null)}>すべて <span className="opacity-70">{data.quizzes.length}</span></button>
              {data.items.map(i => (
                <button key={i.id} onClick={() => setItemId(i.id)} className={chip(itemId === i.id)}>
                  {i.title} <span className="opacity-70">{i.count}</span>
                </button>
              ))}
            </div>
          )}
          {(genres.length > 0 || levelCounts.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {genres.map(g => <span key={g} className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">#{g}</span>)}
                  {moreGenres > 0 && <span className="px-1 py-0.5 text-gray-400">ほか{moreGenres}ジャンル</span>}
                </div>
              )}
              {levelCounts.map(({ l, n }) => (
                <span key={l} className="inline-flex items-center gap-1"><DifficultyBadge level={l} /> {n}問</span>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setPlaying(true)} disabled={quizzes.length === 0} className={`${btn.primary} py-3 text-base`}>
              ▶ ひとりで遊ぶ（{quizzes.length}問）
            </button>
            <button
              onClick={() => router.push(roomUrl(generateRoomCode(), { source: roomSource }))}
              disabled={quizzes.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-rose-600 disabled:opacity-40"
            >
              ⚡ みんなで早押し
            </button>
          </div>

          {isOwner && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <PublishButton
                source={data.source}
                name={data.title}
                quizCount={data.quizzes.length}
                isPublic={data.isPublic}
                authorName={data.authorName}
                defaultAuthor={defaultAuthor}
                publicShelf={data.publicShelf}
              />
              <Link href={data.manageHref} className={btn.ghost}>本棚で開く →</Link>
            </div>
          )}
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
          {quizzes.map(q => <QuizRow key={q.id} quiz={q} density={density} />)}
        </div>
      )}

      {playing && <QuizStage pool={quizzes} title={playTitle} canRecord={loggedIn && isOwner} onClose={() => setPlaying(false)} />}
    </div>
  )
}
