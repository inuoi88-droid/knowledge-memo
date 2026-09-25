'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { QuizSet, QuizWithSource } from '@/types'
import { useDensity } from '@/lib/density'
import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS } from '@/lib/quiz'
import { generateRoomCode, roomUrl, stashLocalRoomQuizzes } from '@/lib/room'
import { btn, card, chip, input } from '@/lib/ui'
import QuizRow from './QuizRow'
import QuizPlayer from './QuizPlayer'
import DensityToggle from './DensityToggle'
import CreateSetDialog from './CreateSetDialog'

type Tab = 'list' | 'mine' | 'public'
const PAGE = 100

export default function QuizHub({
  quizzes,
  mySets,
  publicSets,
  initialGenre,
  initialTab,
  authorName,
}: {
  quizzes: QuizWithSource[]
  mySets: QuizSet[]
  publicSets: QuizSet[]
  initialGenre: string | null
  initialTab: Tab
  authorName: string
}) {
  const router = useRouter()
  const density = useDensity()
  const [tab, setTab] = useState<Tab>(initialTab)

  const [genres, setGenres] = useState<string[]>(initialGenre ? [initialGenre] : [])
  const [matchAll, setMatchAll] = useState(false)
  const [levels, setLevels] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  const [revealAll, setRevealAll] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [playing, setPlaying] = useState(false)
  const [creating, setCreating] = useState(false)

  const genreCounts = new Map<string, number>()
  for (const q of quizzes) for (const t of q.tags) genreCounts.set(t, (genreCounts.get(t) ?? 0) + 1)
  const allGenres = [...genreCounts].sort((a, b) => b[1] - a[1])

  const kw = keyword.trim().toLowerCase()
  const filtered = quizzes.filter(q => {
    if (genres.length > 0) {
      const hit = matchAll ? genres.every(g => q.tags.includes(g)) : genres.some(g => q.tags.includes(g))
      if (!hit) return false
    }
    if (levels.length > 0 && !levels.includes(q.difficulty ?? 0)) return false
    if (kw && ![q.question, q.answer, q.explanation ?? ''].some(s => s.toLowerCase().includes(kw))) return false
    return true
  })

  const conditionLabel = [
    genres.map(g => `#${g}`).join(matchAll ? '×' : '・'),
    levels.length > 0 && levels.map(l => (l === 0 ? '難易度なし' : '★'.repeat(l))).join('/'),
    kw && `「${keyword.trim()}」`,
  ].filter(Boolean).join(' ') || 'すべてのクイズ'

  function toggle<T>(list: T[], v: T, set: (l: T[]) => void) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
    setShown(PAGE)
  }

  function startLocalRoom() {
    const code = generateRoomCode()
    stashLocalRoomQuizzes(code, conditionLabel, filtered)
    router.push(roomUrl(code, { local: true }))
  }

  const hasFilter = genres.length > 0 || levels.length > 0 || !!kw

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">クイズ</h1>
          <p className="mt-0.5 text-sm text-gray-500">ジャンルや難易度で選んで遊んだり、セットにしてみんなと共有できます。</p>
        </div>
        <div className="flex w-full rounded-xl bg-gray-100 p-1 text-xs sm:w-auto sm:text-sm">
          {([
            ['list', `クイズ一覧 (${quizzes.length})`],
            ['mine', `マイセット (${mySets.length})`],
            ['public', 'みんなのセット'],
          ] as [Tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 font-medium transition-colors sm:px-3 ${tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'list' && (
        <>
          <div className={`${card} flex flex-col gap-3 p-4`}>
            <div className="flex flex-wrap items-start gap-2">
              <span className="w-14 shrink-0 pt-0.5 text-xs font-medium text-gray-500">ジャンル</span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {allGenres.length === 0 && <span className="text-xs text-gray-400">クイズにジャンルを付けると選べるようになります</span>}
                {allGenres.map(([g, n]) => (
                  <button key={g} onClick={() => toggle(genres, g, setGenres)} className={chip(genres.includes(g))}>
                    #{g} <span className="opacity-60">{n}</span>
                  </button>
                ))}
              </div>
              {genres.length > 1 && (
                <button onClick={() => setMatchAll(v => !v)} className="text-xs text-indigo-600 hover:underline">
                  {matchAll ? 'すべて含む' : 'どれかを含む'} ⇄
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <span className="w-14 shrink-0 pt-0.5 text-xs font-medium text-gray-500">難易度</span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {DIFFICULTY_LEVELS.map(l => (
                  <button key={l} onClick={() => toggle(levels, l, setLevels)} className={chip(levels.includes(l))} title={DIFFICULTY_LABELS[l]}>
                    {'★'.repeat(l)} <span className="hidden sm:inline">{DIFFICULTY_LABELS[l]}</span>
                  </button>
                ))}
                <button onClick={() => toggle(levels, 0, setLevels)} className={chip(levels.includes(0))}>未設定</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-medium text-gray-500">検索</span>
              <input value={keyword} onChange={e => { setKeyword(e.target.value); setShown(PAGE) }}
                placeholder="問題・答え・解説から探す" className={`${input} max-w-sm flex-1 py-1.5`} />
              {hasFilter && (
                <button onClick={() => { setGenres([]); setLevels([]); setKeyword('') }} className={btn.ghost}>条件をクリア</button>
              )}
            </div>
          </div>

          <div className={`${card} flex flex-wrap items-center gap-3 border-indigo-200 bg-indigo-50/60 p-3`}>
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <div className="truncate text-sm font-semibold text-gray-800">{conditionLabel}</div>
              <div className="text-xs text-gray-500"><b className="text-base text-indigo-700">{filtered.length}</b> 問が該当</div>
            </div>
            <button onClick={() => setPlaying(true)} disabled={filtered.length === 0} className={btn.primary}>▶ ひとりで遊ぶ</button>
            <button onClick={startLocalRoom} disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-600 disabled:opacity-40">
              ⚡ 早押しで遊ぶ
            </button>
            <button onClick={() => setCreating(true)} disabled={filtered.length === 0} className={btn.secondary}>＋ セットにする</button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
              <input type="checkbox" checked={revealAll} onChange={e => setRevealAll(e.target.checked)} className="accent-indigo-600" />
              答えをすべて表示
            </label>
            <DensityToggle />
          </div>

          {quizzes.length === 0 ? (
            <div className={`${card} p-10 text-center text-sm text-gray-500`}>
              まだクイズがありません。<Link href="/dashboard" className="text-indigo-600 hover:underline">本棚</Link>のアイテムを開いて、クイズを追加しましょう。
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">条件に合うクイズがありません。</p>
          ) : (
            <div className={`${card} divide-y divide-gray-100 overflow-hidden`}>
              {filtered.slice(0, shown).map(q => (
                <QuizRow
                  key={q.id}
                  quiz={q}
                  density={density}
                  revealAll={revealAll}
                  onTagClick={g => { if (!genres.includes(g)) setGenres([...genres, g]) }}
                  source={q.item_title && q.shelf_id ? { title: q.item_title, href: `/dashboard/${q.shelf_id}/${q.item_id}` } : null}
                />
              ))}
              {filtered.length > shown && (
                <button onClick={() => setShown(s => s + PAGE)} className="w-full py-3 text-sm text-indigo-600 hover:bg-indigo-50">
                  さらに表示（残り {filtered.length - shown}問）
                </button>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'mine' && (
        mySets.length === 0 ? (
          <div className={`${card} p-10 text-center text-sm text-gray-500`}>
            まだセットがありません。「クイズ一覧」で条件を選んで「＋ セットにする」から作れます。
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mySets.map(s => <SetCard key={s.id} set={s} mine />)}
          </div>
        )
      )}

      {tab === 'public' && (
        publicSets.length === 0 ? (
          <div className={`${card} p-10 text-center text-sm text-gray-500`}>
            まだ公開されているセットがありません。自分のセットを公開してみましょう！
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {publicSets.map(s => <SetCard key={s.id} set={s} />)}
          </div>
        )
      )}

      {playing && <QuizPlayer quizzes={filtered} title={conditionLabel} onClose={() => setPlaying(false)} />}
      {creating && (
        <CreateSetDialog
          quizIds={filtered.map(q => q.id)}
          defaultTitle={conditionLabel === 'すべてのクイズ' ? '' : conditionLabel}
          authorName={authorName}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

function SetCard({ set, mine = false }: { set: QuizSet; mine?: boolean }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  async function togglePublic() {
    await createClient().from('quiz_sets').update({ is_public: !set.is_public }).eq('id', set.id)
    router.refresh()
  }

  async function remove() {
    if (!confirm(`「${set.title}」を削除しますか？（クイズ自体は消えません）`)) return
    await createClient().from('quiz_sets').delete().eq('id', set.id)
    router.refresh()
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${location.origin}/quiz/sets/${set.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`${card} flex flex-col gap-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/quiz/sets/${set.id}`} className="min-w-0 hover:text-indigo-700">
          <div className="truncate font-semibold">{set.title}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            {set.quiz_count}問{!mine && set.author_name && ` · by ${set.author_name}`}
          </div>
        </Link>
        {mine && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${set.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            {set.is_public ? '公開中' : '非公開'}
          </span>
        )}
      </div>
      {set.description && <p className="line-clamp-2 text-xs text-gray-500">{set.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Link href={`/quiz/sets/${set.id}`} className={btn.small}>▶ 遊ぶ</Link>
        <button onClick={() => router.push(roomUrl(generateRoomCode(), { setId: set.id }))}
          className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-600">
          ⚡ 早押し
        </button>
        {mine && (
          <>
            {set.is_public && <button onClick={copyLink} className={btn.ghost}>{copied ? '✓ コピーしました' : '🔗 リンクをコピー'}</button>}
            <button onClick={togglePublic} className={btn.ghost}>{set.is_public ? '非公開にする' : '公開する'}</button>
            <button onClick={remove} className={`${btn.danger} ml-auto`}>削除</button>
          </>
        )}
      </div>
    </div>
  )
}
