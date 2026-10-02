'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PlaySessionRecord, Quiz, QuizProgress } from '@/types'
import { countTags, shuffle } from '@/lib/quiz'
import { MODES, RULES } from '@/lib/play'
import { MASTERY, MASTERY_ORDER, countMastery, formatDays, isDue, masteryOf, type Mastery, type StudySettings } from '@/lib/progress'
import { unlockSound } from '@/lib/sound'
import { card } from '@/lib/ui'
import { perfNow } from '@/lib/stage'
import QuizFilters from '@/components/quiz/QuizFilters'
import CountPicker from '@/components/quiz/CountPicker'
import StudySession, { STUDY_KINDS, buildStudyQueue, type StudyItem, type StudyKind } from './StudySession'
import StudySettingsDialog from './StudySettingsDialog'

const REVIEW_CAP = 100

function MasteryBar({ counts, total, className = 'h-3' }: { counts: Record<Mastery, number>; total: number; className?: string }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-gray-100 ${className}`}>
      {MASTERY_ORDER.map(m => counts[m] > 0 && (
        <div key={m} className={MASTERY[m].color} style={{ width: `${(counts[m] / Math.max(1, total)) * 100}%` }} title={`${MASTERY[m].label} ${counts[m]}問`} />
      ))}
    </div>
  )
}

function sessionModeLabel(mode: string, rule: string) {
  if (mode.startsWith('study-')) {
    const k = STUDY_KINDS[mode.slice(6) as StudyKind]
    return k ? `${k.icon} ${k.name}` : mode
  }
  const m = MODES.find(x => x.id === mode)
  const r = RULES.find(x => x.id === rule)
  return `${m ? `${m.icon} ${m.name}` : mode}${r && r.id !== 'normal' ? ` ・ ${r.name}` : ''}`
}

export default function StudyHub({
  quizzes,
  progress,
  sessions,
  nowMs,
  settings,
}: {
  quizzes: Quiz[]
  progress: QuizProgress[]
  sessions: PlaySessionRecord[]
  nowMs: number
  settings: StudySettings
}) {
  const router = useRouter()
  const [editingSettings, setEditingSettings] = useState(false)
  const steps = settings.reviewDays.length
  const [genres, setGenres] = useState<string[]>([])
  const [matchAll, setMatchAll] = useState(false)
  const [levels, setLevels] = useState<number[]>([])
  const [learnCount, setLearnCount] = useState(20)
  const [checkCount, setCheckCount] = useState(10)
  const [session, setSession] = useState<{ kind: StudyKind; title: string; queue: StudyItem[]; startedAt: number } | null>(null)

  const progressMap = new Map(progress.map(p => [p.memo_id, p]))
  const allIds = quizzes.map(q => q.id)
  const overall = countMastery(allIds, progressMap, steps)
  const due = quizzes
    .filter(q => isDue(progressMap.get(q.id), nowMs))
    .sort((a, b) => Date.parse(progressMap.get(a.id)!.due_at!) - Date.parse(progressMap.get(b.id)!.due_at!))

  const target = quizzes.filter(q => {
    if (genres.length > 0) {
      const hit = matchAll ? genres.every(g => q.tags.includes(g)) : genres.some(g => q.tags.includes(g))
      if (!hit) return false
    }
    return levels.length === 0 || levels.includes(q.difficulty ?? 0)
  })
  const targetCounts = countMastery(target.map(q => q.id), progressMap, steps)
  const learnPool = target.filter(q => { const m = masteryOf(progressMap.get(q.id), steps); return m === 'new' || m === 'learning' })
  const checkPool = target.filter(q => masteryOf(progressMap.get(q.id), steps) !== 'mastered')
  const rangeLabel = [
    genres.map(g => `#${g}`).join(matchAll ? '×' : '・'),
    levels.length > 0 && levels.map(l => (l === 0 ? '難易度なし' : '★'.repeat(l))).join('/'),
  ].filter(Boolean).join(' ') || 'すべてのクイズ'

  const genreStats = countTags(quizzes).slice(0, 12).map(g => {
    const ids = quizzes.filter(q => q.tags.includes(g.name)).map(q => q.id)
    return { ...g, counts: countMastery(ids, progressMap, steps) }
  })

  function start(kind: StudyKind) {
    unlockSound()
    let picked: Quiz[]
    let title = rangeLabel
    if (kind === 'review') {
      picked = due.slice(0, REVIEW_CAP)
      title = '今日の復習'
    } else if (kind === 'learn') {
      // まちがえたことのある問題 → まだやっていない問題 の順に出す
      const learning = shuffle(learnPool.filter(q => progressMap.has(q.id)))
      const fresh = shuffle(learnPool.filter(q => !progressMap.has(q.id)))
      picked = [...learning, ...fresh].slice(0, learnCount)
    } else {
      picked = shuffle(checkPool).slice(0, checkCount)
    }
    if (picked.length === 0) return
    setSession({ kind, title, queue: buildStudyQueue(kind, picked, settings), startedAt: perfNow() })
  }

  function toggleIn<T>(list: T[], v: T, set: (l: T[]) => void) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  }

  if (quizzes.length === 0) {
    return (
      <div className={`${card} p-10 text-center text-sm text-gray-500`}>
        まだクイズがありません。<Link href="/dashboard" className="text-indigo-600 hover:underline">本棚</Link>のアイテムを開いて、クイズを追加しましょう。
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">📖 勉強</h1>
          <p className="mt-0.5 text-sm text-gray-500">覚える → 確かめる → 忘れた頃に復習、の3ステップで確実に身につけよう。</p>
        </div>
        <button
          onClick={() => setEditingSettings(true)}
          className="rounded-xl border-2 border-gray-100 bg-white px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:border-indigo-200"
        >
          <span className="font-bold text-gray-900">⚙️ 学習の設定</span>
          <span className="ml-2">書く回数 {settings.checkRepeats}回 ・ 間隔 {settings.reviewDays.map(formatDays).join('→')}</span>
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col justify-between gap-3 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-5 text-white shadow-lg">
          <div>
            <div className="text-xs font-bold tracking-widest opacity-90">🔁 今日の復習</div>
            <div className="text-5xl font-black leading-tight">{due.length}<span className="ml-1 text-base font-bold opacity-90">問</span></div>
            <p className="mt-1 text-xs opacity-90">覚えた問題が、忘れかけた頃にここに出てきます。</p>
          </div>
          <button
            onClick={() => start('review')}
            disabled={due.length === 0}
            className="rounded-2xl bg-white py-3 font-black text-orange-600 shadow transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {due.length === 0 ? '今日の復習はおわり！🎉' : '▶ 復習をはじめる'}
          </button>
        </div>

        <div className={`${card} flex flex-col gap-3 p-5 lg:col-span-2`}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-black text-gray-900">覚えた度</span>
            <span className="text-xs text-gray-500">全{quizzes.length}問</span>
          </div>
          <MasteryBar counts={overall} total={quizzes.length} className="h-4" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MASTERY_ORDER.map(m => (
              <div key={m} className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className={`h-2.5 w-2.5 rounded-full ${MASTERY[m].color}`} />{MASTERY[m].label}</div>
                <div className={`text-xl font-black ${MASTERY[m].text}`}>{overall[m]}<span className="ml-0.5 text-xs font-normal text-gray-400">問</span></div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">
            覚えた度は、復習の時期に正解するたびに1段階上がり（同じ日に何度正解しても1段階だけ）、{Math.max(1, steps - 1)}段階目で「覚えた」になります。まちがえると最初からです。
          </p>
        </div>
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[3px] shadow-lg">
        <div className="flex flex-col gap-5 rounded-[21px] bg-white p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-gray-900">学習をはじめる</h2>
            <span className="ml-auto text-sm text-gray-500"><b className="text-xl font-black text-indigo-600">{target.length}</b> 問</span>
          </div>
          <QuizFilters
            tagCounts={countTags(quizzes)}
            genres={genres}
            matchAll={matchAll}
            levels={levels}
            onToggleGenre={g => toggleIn(genres, g, setGenres)}
            onToggleMatchAll={() => setMatchAll(v => !v)}
            onToggleLevel={l => toggleIn(levels, l, setLevels)}
            onClear={() => { setGenres([]); setLevels([]) }}
          />
          <MasteryBar counts={targetCounts} total={target.length} />

          <div className="grid gap-3 md:grid-cols-2">
            {([
              ['learn', learnPool, learnCount, setLearnCount, '未学習・学習中の問題'],
              ['check', checkPool, checkCount, setCheckCount, 'まだ「覚えた」になっていない問題'],
            ] as const).map(([kind, pool, count, setCount, poolLabel], i) => (
              <div key={kind} className="flex flex-col gap-3 rounded-2xl border-2 border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl">{STUDY_KINDS[kind].icon}</span>
                  <div className="min-w-0">
                    <div className="font-black text-gray-900">STEP {i + 1}　{STUDY_KINDS[kind].name}</div>
                    <div className="text-xs text-gray-500">{STUDY_KINDS[kind].desc}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {poolLabel}：<b className="text-gray-900">{pool.length}問</b>
                  {kind === 'check' && <>（1問につき <b className="text-gray-900">{settings.checkRepeats}回</b> 正しく書けたら合格）</>}
                </div>
                {pool.length > 0 && <CountPicker max={pool.length} value={Math.min(count, pool.length)} onChange={setCount} presets={[5, 10, 20, 50]} />}
                <button
                  onClick={() => start(kind)}
                  disabled={pool.length === 0}
                  className="mt-auto rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-black text-white shadow disabled:opacity-40"
                >
                  {pool.length === 0 ? 'この範囲はぜんぶ覚えました 🎉' : `▶ ${Math.min(count, pool.length)}問で${STUDY_KINDS[kind].name}`}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            STEP 3「定着」は、上の <b>🔁 今日の復習</b> です。正解した問題が {settings.reviewDays.map(formatDays).join(' → ')} 後…と間隔をあけて出てきます（
            <button onClick={() => setEditingSettings(true)} className="text-indigo-600 hover:underline">間隔を変える</button>）。
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="mb-3 text-sm font-black text-gray-900">ジャンル別の進み具合</h2>
          <ul className="flex flex-col gap-2.5">
            {genreStats.map(g => (
              <li key={g.name}>
                <button onClick={() => setGenres([g.name])} className="w-full text-left" title="このジャンルで学習する">
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-bold text-gray-800 hover:text-indigo-700">#{g.name}</span>
                    <span className="text-xs text-gray-500">
                      覚えた <b className="text-emerald-600">{Math.round((g.counts.mastered / g.count) * 100)}%</b> ・ {g.count}問
                    </span>
                  </div>
                  <MasteryBar counts={g.counts} total={g.count} className="h-2" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="mb-3 text-sm font-black text-gray-900">最近の記録</h2>
          {sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">まだ記録がありません。クイズで遊ぶか勉強すると、ここに残ります。</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sessions.map(s => {
                const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-20 shrink-0 text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-800">{s.title}</span>
                      <span className="text-xs text-gray-500">{sessionModeLabel(s.mode, s.rule)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-black tabular-nums text-gray-900">{s.correct}<span className="text-xs text-gray-400">/{s.total}</span></span>
                      <span className={`text-xs font-bold ${acc >= 80 ? 'text-emerald-600' : acc >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>{acc}%</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-gray-400">記録は最新300件まで保存されます。</p>
        </section>
      </div>

      {session && (
        <StudySession
          kind={session.kind}
          title={session.title}
          initialQueue={session.queue}
          settings={settings}
          startedAt={session.startedAt}
          onClose={() => { setSession(null); router.refresh() }}
        />
      )}
      {editingSettings && (
        <StudySettingsDialog
          value={settings}
          onClose={() => setEditingSettings(false)}
          onSaved={() => { setEditingSettings(false); router.refresh() }}
        />
      )}
    </div>
  )
}
