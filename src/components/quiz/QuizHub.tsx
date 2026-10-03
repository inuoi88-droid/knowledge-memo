'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PublicSource, Quiz, QuizProgress, QuizWithSource, ShelfNode } from '@/types'
import { useDensity } from '@/lib/density'
import { countTags } from '@/lib/quiz'
import { DEFAULT_CONFIG, modeAvailability, startSession, type PlayConfig, type PlayMode, type Session } from '@/lib/play'
import { isDue, isWeak } from '@/lib/progress'
import { ALL_SCOPE, inScope, isAllScope, normalizeScope, scopeLabel, sourceHref, type Scope } from '@/lib/scope'
import { unlockSound } from '@/lib/sound'
import { generateRoomCode, roomUrl, stashLocalRoomQuizzes } from '@/lib/room'
import { btn, card } from '@/lib/ui'
import ScopePicker, { countByItem, quizTree } from '@/components/ScopePicker'
import QuizFilters, { STUDY_STATUS_LABELS, type StudyStatus } from './QuizFilters'
import QuizRow from './QuizRow'
import QuizStage from './QuizStage'
import PlaySetup from './PlaySetup'
import DensityToggle from './DensityToggle'

export type HubTab = 'play' | 'list' | 'public'
const PAGE = 100

export default function QuizHub({
  quizzes,
  tree,
  publicSources,
  initialScope,
  initialGenre,
  initialTab,
  initialMode,
  progress,
  nowMs,
}: {
  quizzes: QuizWithSource[]
  tree: ShelfNode[]
  publicSources: PublicSource[]
  initialScope: Scope | null
  initialGenre: string | null
  initialTab: HubTab
  initialMode: PlayMode | null
  progress: QuizProgress[]
  nowMs: number
}) {
  const router = useRouter()
  const density = useDensity()
  const [tab, setTab] = useState<HubTab>(initialTab)

  const counts = countByItem(quizzes)
  const qTree = quizTree(tree, counts)
  const [scope, setScope] = useState<Scope>(() => normalizeScope(initialScope ?? ALL_SCOPE, qTree))
  const [showFilters, setShowFilters] = useState(!!initialGenre)
  const [genres, setGenres] = useState<string[]>(initialGenre ? [initialGenre] : [])
  const [matchAll, setMatchAll] = useState(false)
  const [levels, setLevels] = useState<number[]>([])
  const [statuses, setStatuses] = useState<StudyStatus[]>([])
  const [keyword, setKeyword] = useState('')
  const [revealAll, setRevealAll] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [playConfig, setPlayConfig] = useState<PlayConfig>({ ...DEFAULT_CONFIG, mode: initialMode ?? DEFAULT_CONFIG.mode })
  const [stage, setStage] = useState<{ pool: Quiz[]; title: string; session?: Session } | null>(null)

  const progressMap = new Map(progress.map(p => [p.memo_id, p]))
  const scoped = quizzes.filter(q => inScope(q, scope))
  const tagCounts = countTags(scoped)

  const kw = keyword.trim().toLowerCase()
  const filtered = scoped.filter(q => {
    if (genres.length > 0) {
      const hit = matchAll ? genres.every(g => q.tags.includes(g)) : genres.some(g => q.tags.includes(g))
      if (!hit) return false
    }
    if (levels.length > 0 && !levels.includes(q.difficulty ?? 0)) return false
    if (statuses.length > 0) {
      const p = progressMap.get(q.id)
      const hit = (statuses.includes('new') && !p) || (statuses.includes('weak') && isWeak(p)) || (statuses.includes('due') && isDue(p, nowMs))
      if (!hit) return false
    }
    if (kw && ![q.question, q.answer, q.explanation ?? ''].some(s => s.toLowerCase().includes(kw))) return false
    return true
  })

  const filterCount = genres.length + levels.length + statuses.length
  const conditionLabel = [
    !isAllScope(scope) && scopeLabel(scope, qTree),
    genres.map(g => `#${g}`).join(matchAll ? '×' : '・'),
    levels.length > 0 && levels.map(l => (l === 0 ? '難易度なし' : '★'.repeat(l))).join('/'),
    statuses.length > 0 && statuses.map(s => STUDY_STATUS_LABELS[s].replace(/^\S+\s/, '')).join('・'),
    kw && `「${keyword.trim()}」`,
  ].filter(Boolean).join(' ') || 'すべてのクイズ'

  // 問題を選んでいればその問題、選んでいなければ絞り込み結果が対象
  const usingSelection = selected.size > 0
  const target = usingSelection ? quizzes.filter(q => selected.has(q.id)) : filtered
  const targetLabel = usingSelection ? `選んだ${selected.size}問` : conditionLabel

  function toggleIn<T>(list: T[], v: T, set: (l: T[]) => void) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
    setShown(PAGE)
  }

  function changeScope(s: Scope) {
    setScope(s)
    setGenres([])
    setShown(PAGE)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startPlay() {
    unlockSound()
    setStage({ pool: target, title: targetLabel, session: startSession(target, playConfig) })
  }

  function startLocalRoom() {
    const code = generateRoomCode()
    stashLocalRoomQuizzes(code, targetLabel, target)
    router.push(roomUrl(code, { local: true }))
  }

  const range = (
    <div className="flex flex-col gap-3">
      <ScopePicker tree={qTree} counts={counts} value={scope} onChange={changeScope} total={scoped.length} />
      {tab !== 'list' && (
        <div>
          <button onClick={() => setShowFilters(v => !v)} className="text-xs font-bold text-indigo-600 hover:underline">
            {showFilters ? '▾' : '▸'} タグ・難易度・学習状況でさらに絞り込む{filterCount > 0 && `（${filterCount}件）`}
          </button>
        </div>
      )}
      {(showFilters || tab === 'list') && (
        <QuizFilters
          tagCounts={tagCounts}
          genres={genres}
          matchAll={matchAll}
          levels={levels}
          onToggleGenre={g => toggleIn(genres, g, setGenres)}
          onToggleMatchAll={() => setMatchAll(v => !v)}
          onToggleLevel={l => toggleIn(levels, l, setLevels)}
          statuses={statuses}
          onToggleStatus={s => toggleIn(statuses, s, setStatuses)}
          keyword={tab === 'list' ? keyword : null}
          onKeyword={v => { setKeyword(v); setShown(PAGE) }}
          onClear={() => { setGenres([]); setLevels([]); setStatuses([]); setKeyword('') }}
        />
      )}
    </div>
  )

  const selectionNote = usingSelection && (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
      ☑ 問題一覧で選んだ <b>{selected.size}問</b> が対象です
      <button onClick={() => setSelected(new Set())} className="text-xs text-indigo-600 hover:underline">選択を解除して範囲で選ぶ</button>
    </div>
  )

  const mine = publicSources.filter(s => s.is_mine)
  const others = publicSources.filter(s => !s.is_mine)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">🎯 クイズ</h1>
          <p className="mt-0.5 text-sm text-gray-500">全{quizzes.length}問 ・ 本棚と遊び方を選んでスタート！</p>
        </div>
        <div className="grid w-full grid-cols-3 rounded-2xl bg-gray-100 p-1 text-xs sm:w-auto sm:text-sm">
          {([
            ['play', '🎮 あそぶ'],
            ['list', '📋 問題一覧'],
            ['public', '🌏 みんなの'],
          ] as [HubTab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-xl px-2 py-2 font-bold transition-colors sm:px-3 ${tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'play' && (
        quizzes.length === 0 ? (
          <EmptyQuizzes />
        ) : (
          <div className="rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[3px] shadow-lg">
            <div className="flex flex-col gap-6 rounded-[21px] bg-white p-4 sm:p-6">
              <Step n={1} title="はんいを選ぶ" aside={<span className="text-sm text-gray-500"><b className="text-2xl font-black text-indigo-600">{target.length}</b> 問</span>}>
                {selectionNote || range}
              </Step>
              <Step n={2} title="あそびかたを選ぶ">
                <PlaySetup pool={target} value={playConfig} onChange={setPlayConfig} />
              </Step>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={startPlay}
                  disabled={!modeAvailability(playConfig.mode, target).ok}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-xl font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                >
                  ▶ スタート！
                </button>
                <button
                  onClick={startLocalRoom}
                  disabled={target.length === 0}
                  className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-4 font-black text-white shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-40"
                  title="ルームを作って友だちと早押し対決"
                >
                  ⚡ みんなで早押し
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'list' && (
        <>
          <div className={`${card} p-4`}>{range}</div>

          <div className={`${card} flex flex-wrap items-center gap-3 p-3 ${usingSelection ? 'border-amber-300 bg-amber-50/70' : 'border-indigo-200 bg-indigo-50/60'}`}>
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              {usingSelection ? (
                <>
                  <div className="text-sm font-semibold text-gray-800">☑ 選んだ問題</div>
                  <div className="text-xs text-gray-500">
                    <b className="text-base text-amber-700">{selected.size}</b> 問を選択中
                    <button onClick={() => setSelected(new Set())} className="ml-2 text-indigo-600 hover:underline">選択を解除</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="truncate text-sm font-semibold text-gray-800">{conditionLabel}</div>
                  <div className="text-xs text-gray-500"><b className="text-base text-indigo-700">{filtered.length}</b> 問が該当</div>
                </>
              )}
            </div>
            <button onClick={() => setTab('play')} disabled={target.length === 0} className={btn.primary}>🎮 この問題で遊ぶ</button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={() => setSelecting(v => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selecting ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              {selecting ? '☑ 問題を選んでいます' : '☐ 問題を選ぶ'}
            </button>
            {selecting && (
              <>
                <button onClick={() => setSelected(prev => new Set([...prev, ...filtered.map(q => q.id)]))} className="text-xs text-indigo-600 hover:underline">
                  表示中の{filtered.length}問をすべて選ぶ
                </button>
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline">選択を解除</button>
                )}
              </>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" checked={revealAll} onChange={e => setRevealAll(e.target.checked)} className="accent-indigo-600" />
                答えをすべて表示
              </label>
              <DensityToggle />
            </div>
          </div>

          {quizzes.length === 0 ? (
            <EmptyQuizzes />
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
                  onTagClick={g => { setShowFilters(true); if (!genres.includes(g)) setGenres([...genres, g]) }}
                  source={q.item_title && q.shelf_id ? { title: q.item_title, href: `/dashboard/${q.shelf_id}/${q.item_id}` } : null}
                  selection={selecting ? { checked: selected.has(q.id), onToggle: () => toggleSelect(q.id) } : undefined}
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

      {tab === 'public' && (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-sm font-black text-gray-900">🌏 みんなが公開しているクイズ</h2>
            {others.length === 0 ? (
              <div className={`${card} p-8 text-center text-sm text-gray-500`}>まだ公開されているクイズがありません。</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {others.map(s => <SourceCard key={`${s.kind}-${s.id}`} source={s} />)}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-black text-gray-900">あなたが公開中</h2>
            {mine.length === 0 ? (
              <div className={`${card} p-6 text-sm leading-relaxed text-gray-500`}>
                まだ公開していません。<Link href="/dashboard" className="text-indigo-600 hover:underline">本棚</Link>や、その中のアイテムを開いて「🌏 公開する」を押すと、中のクイズをまとめて公開できます。
                引用・感想のメモは公開されません。
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {mine.map(s => <SourceCard key={`${s.kind}-${s.id}`} source={s} />)}
              </div>
            )}
          </section>
        </div>
      )}

      {stage && (
        <QuizStage
          pool={stage.pool}
          title={stage.title}
          initialSession={stage.session}
          canRecord
          onClose={() => { setStage(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-black text-white">{n}</span>
        <h2 className="text-base font-black text-gray-900">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

function EmptyQuizzes() {
  return (
    <div className={`${card} p-10 text-center text-sm text-gray-500`}>
      まだクイズがありません。<Link href="/dashboard" className="text-indigo-600 hover:underline">本棚</Link>のアイテムを開いて、クイズを追加しましょう。
    </div>
  )
}

function SourceCard({ source }: { source: PublicSource }) {
  const router = useRouter()
  const href = sourceHref(source)
  return (
    <div className={`${card} flex flex-col gap-3 p-4 transition-shadow hover:shadow-md`}>
      <Link href={href} className="flex min-w-0 items-center gap-3 hover:text-indigo-700">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xl">
          {source.kind === 'shelf' ? '📚' : '📕'}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold">{source.title}</span>
          <span className="block text-xs text-gray-500">
            {source.kind === 'shelf' ? '本棚' : 'アイテム'} ・ {source.quiz_count}問{source.author_name && ` · by ${source.author_name}`}
          </span>
        </span>
      </Link>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Link href={href} className={btn.small}>▶ 遊ぶ</Link>
        <button onClick={() => router.push(roomUrl(generateRoomCode(), { source }))}
          className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-600">
          ⚡ 早押し
        </button>
      </div>
    </div>
  )
}
