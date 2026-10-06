'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PlaySessionRecord, QuizProgress, QuizWithSource, ShelfNode } from '@/types'
import { shuffle } from '@/lib/quiz'
import { MODES, RULES } from '@/lib/play'
import {
  MASTERY, MASTERY_ORDER, countIntroducedToday, countMastery, formatDays, isDue, saveStudySettings, studyDayStart,
  type Mastery, type NewOrder, type StudySettings,
} from '@/lib/progress'
import { inScope, normalizeScope, scopeLabel, type Scope } from '@/lib/scope'
import { formatMinute, type ReminderSettings } from '@/lib/reminders'
import { unlockSound } from '@/lib/sound'
import { btn, card } from '@/lib/ui'
import ScopePicker, { countByItem, quizTree } from '@/components/ScopePicker'
import StudySession, { STUDY_STEPS } from './StudySession'
import StudySettingsDialog from './StudySettingsDialog'
import ReminderDialog from './ReminderDialog'

// 1回の学習で出す復習の上限（たまっていたら何回かに分ける）
const REVIEW_CAP = 100
const DAY_MS = 24 * 60 * 60 * 1000
const OLD_STUDY_LABELS: Record<string, string> = { learn: '📖 覚える', check: '✍️ 確かめる', review: '🔁 復習' }

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
  if (mode === 'study') return '📖 学習'
  if (mode.startsWith('study-')) return OLD_STUDY_LABELS[mode.slice(6)] ?? mode
  const m = MODES.find(x => x.id === mode)
  const r = RULES.find(x => x.id === rule)
  return `${m ? `${m.icon} ${m.name}` : mode}${r && r.id !== 'normal' ? ` ・ ${r.name}` : ''}`
}

// seen: 「もっと覚える」で続けたときに同じ問題を選ばないよう、続けて出した新しい問題をためておく
interface SessionState { key: number; title: string; reviews: QuizWithSource[]; fresh: QuizWithSource[]; seen: string[] }

export default function StudyHub({
  quizzes,
  progress,
  sessions,
  nowMs,
  settings,
  tree,
  initialScope,
  reminder,
  initialNotify,
}: {
  quizzes: QuizWithSource[]
  progress: QuizProgress[]
  sessions: PlaySessionRecord[]
  nowMs: number
  settings: StudySettings
  tree: ShelfNode[]
  initialScope: Scope | null
  reminder: { settings: ReminderSettings; deviceCount: number; email: string | null }
  initialNotify: boolean
}) {
  const router = useRouter()
  const [editingReminder, setEditingReminder] = useState(initialNotify)
  const reminderOn = reminder.settings.pushEnabled || reminder.settings.emailEnabled
  const counts = countByItem(quizzes)
  const qTree = quizTree(tree, counts)
  const [scope, setScope] = useState<Scope>(() => normalizeScope(initialScope ?? settings.scope, qTree))
  const [order, setOrder] = useState<NewOrder>(settings.newOrder)
  const [editingSettings, setEditingSettings] = useState(false)
  const [session, setSession] = useState<SessionState | null>(null)
  const current: StudySettings = { ...settings, scope, newOrder: order }
  const steps = settings.reviewDays.length

  const progressMap = new Map(progress.map(p => [p.memo_id, p]))
  const dueAt = (q: QuizWithSource) => Date.parse(progressMap.get(q.id)?.due_at ?? '')
  const scoped = quizzes.filter(q => inScope(q, scope))
  const dueScoped = scoped.filter(q => isDue(progressMap.get(q.id), nowMs)).sort((a, b) => dueAt(a) - dueAt(b))
  const dueOutside = quizzes.filter(q => isDue(progressMap.get(q.id), nowMs)).length - dueScoped.length
  const unseen = scoped.filter(q => !progressMap.has(q.id))
  const introducedToday = countIntroducedToday(progress, nowMs)
  const newLeft = Math.max(0, settings.dailyNew - introducedToday)
  const planReview = Math.min(dueScoped.length, REVIEW_CAP)
  const planNew = Math.min(newLeft, unseen.length)
  const allDone = planReview + planNew === 0
  const minutes = Math.max(1, Math.ceil((planReview * 12 + planNew * (10 + settings.checkRepeats * 12)) / 60))

  const dayStart = studyDayStart(nowMs)
  const laterToday = scoped.filter(q => { const t = dueAt(q); return t > nowMs && t < dayStart + DAY_MS }).length
  const tomorrow = scoped.filter(q => { const t = dueAt(q); return t >= dayStart + DAY_MS && t < dayStart + 2 * DAY_MS }).length
  const scopeCounts = countMastery(scoped.map(q => q.id), progressMap, steps)
  const label = scopeLabel(scope, qTree)

  function persist(next: Partial<StudySettings>) {
    void saveStudySettings({ ...current, ...next })
  }

  function changeScope(s: Scope) {
    setScope(s)
    persist({ scope: s })
  }

  function changeOrder(o: NewOrder) {
    setOrder(o)
    persist({ newOrder: o })
  }

  function pickFresh(n: number, exclude: ReadonlySet<string> = new Set()) {
    const pool = unseen.filter(q => !exclude.has(q.id))
    const ordered = order === 'random' ? shuffle(pool) : [...pool].sort((a, b) => a.position - b.position)
    return ordered.slice(0, n)
  }

  function start(fresh: QuizWithSource[], reviews: QuizWithSource[], seen: string[] = []) {
    if (fresh.length + reviews.length === 0) return
    unlockSound()
    if (initialScope) persist({})
    setSession(s => ({ key: (s?.key ?? 0) + 1, title: label, reviews, fresh, seen: [...seen, ...fresh.map(q => q.id)] }))
  }

  const reminderDialog = editingReminder && (
    <ReminderDialog
      value={reminder.settings}
      deviceCount={reminder.deviceCount}
      email={reminder.email}
      onClose={() => setEditingReminder(false)}
      onSaved={() => { setEditingReminder(false); router.refresh() }}
    />
  )

  if (quizzes.length === 0) {
    return (
      <div className={`${card} p-10 text-center text-sm text-gray-500`}>
        まだクイズがありません。<Link href="/dashboard" className="text-indigo-600 hover:underline">本棚</Link>のアイテムを開いて、クイズを追加しましょう。
        <div className="mt-4">
          <button onClick={() => setEditingReminder(true)} className={btn.secondary}>🔔 毎日の通知を設定する</button>
        </div>
        {reminderDialog}
      </div>
    )
  }

  const moreFor = (s: SessionState) => {
    const exclude = new Set(s.seen)
    const n = Math.min(settings.dailyNew, unseen.filter(q => !exclude.has(q.id)).length)
    return n > 0 ? { label: `＋ もっと覚える（${n}問）`, onStart: () => start(pickFresh(n, exclude), [], s.seen) } : undefined
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">📖 学習</h1>
          <p className="mt-0.5 text-sm text-gray-500">毎日「今日の学習」を1回やるだけ。復習と新しい問題を、ちょうどいい量で出します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEditingReminder(true)}
            className={`rounded-xl border-2 px-3 py-2 text-left text-xs transition-colors ${reminderOn ? 'border-gray-100 bg-white text-gray-600 hover:border-indigo-200' : 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300'}`}
          >
            <span className="font-bold text-gray-900">🔔 通知</span>
            <span className="ml-2">{reminderOn ? `毎日 ${formatMinute(reminder.settings.remindMinute)}` : 'オフ'}</span>
          </button>
          <button
            onClick={() => setEditingSettings(true)}
            className="rounded-xl border-2 border-gray-100 bg-white px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:border-indigo-200"
          >
            <span className="font-bold text-gray-900">⚙️ 学習の設定</span>
            <span className="ml-2">1日{settings.dailyNew}問 ・ 書く{settings.checkRepeats}回 ・ 間隔 {settings.reviewDays.map(formatDays).join('→')}</span>
          </button>
        </div>
      </div>

      {!reminderOn && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="text-xl">🔔</span>
          <span className="min-w-0 flex-1">毎日決まった時刻に「今日の学習」をお知らせできます。続けるいちばんのコツです。</span>
          <button onClick={() => setEditingReminder(true)} className={btn.primary}>通知を設定する</button>
        </div>
      )}

      <section className="rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[3px] shadow-lg">
        <div className="flex flex-col gap-4 rounded-[21px] bg-white p-4 sm:p-6">
          <ScopePicker tree={qTree} counts={counts} value={scope} onChange={changeScope} total={scoped.length} />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">新しい問題の順番</span>
            <div className="flex rounded-xl bg-gray-100 p-1 text-sm">
              {([['sequential', '▶ 初めから順に'], ['random', '🔀 ランダム']] as [NewOrder, string][]).map(([o, l]) => (
                <button key={o} type="button" onClick={() => changeOrder(o)}
                  className={`rounded-lg px-3 py-1 font-bold transition-colors ${order === o ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {l}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-400">
              {order === 'sequential' ? '追加した順（表の上から）に、前回の続きから出します' : 'まだ出していない問題からランダムに出します'}。一度出した問題が最初から出直すことはありません。
            </span>
          </div>

          {!allDone ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-indigo-50/70 p-4">
              <div className="text-sm font-black text-indigo-950">今日やること</div>
              <ol className="grid gap-2 sm:grid-cols-3">
                {([
                  ['review', planReview > 0 ? `${planReview}問` : 'なし', '前に覚えた問題を思い出す'],
                  ['learn', planNew > 0 ? `${planNew}問` : 'なし', '新しい問題の答えを、まず全部見て覚える'],
                  ['check', planNew > 0 ? `1問${settings.checkRepeats}回` : '—', '全部見たら、答えを書いて身につける'],
                ] as const).map(([s, v, d], i) => (
                  <li key={s} className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ${(s === 'review' ? planReview : planNew) === 0 ? 'opacity-50' : ''}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-black text-white">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-gray-900">{STUDY_STEPS[s].icon} {STUDY_STEPS[s].name} <span className="text-indigo-600">{v}</span></span>
                      <span className="block text-[11px] text-gray-500">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => start(pickFresh(planNew), dueScoped.slice(0, REVIEW_CAP))}
                className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-xl font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="block">▶ 今日の学習をはじめる</span>
                <span className="block text-xs font-bold opacity-80">目安 約{minutes}分</span>
              </button>
              {dueScoped.length > REVIEW_CAP && (
                <p className="text-center text-xs text-gray-500">復習がたまっているので、{REVIEW_CAP}問ずつに分けて出します（残り {dueScoped.length - REVIEW_CAP}問）。</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 p-5 text-center">
              <div className="text-3xl">🎉</div>
              <div className="text-lg font-black text-emerald-800">
                {unseen.length === 0 && scoped.length > 0 ? 'この範囲は全部の問題を覚え始めました！' : '今日の分は完了！'}
              </div>
              <p className="text-xs text-emerald-900/80">
                {laterToday > 0 && <>まちがえた {laterToday}問 が少しあとでまた出ます。</>}
                {tomorrow > 0 ? `明日は復習が ${tomorrow}問 あります。` : 'また明日、復習の時期が来た問題が出てきます。'}
              </p>
              {unseen.length > 0 && (
                <button onClick={() => start(pickFresh(settings.dailyNew), [])} className="mt-1 rounded-xl bg-white px-4 py-2 text-sm font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-100 hover:bg-indigo-50">
                  ＋ もっと覚える（{Math.min(settings.dailyNew, unseen.length)}問）
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>今日 新しく覚えた <b className="text-gray-900">{introducedToday}</b> / {settings.dailyNew}問</span>
            <span>まだ出していない問題 <b className="text-gray-900">{unseen.length}</b>問</span>
            <button onClick={() => setEditingSettings(true)} className="text-indigo-600 hover:underline">1日の問題数を変える</button>
          </div>
          {dueOutside > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ほかの本棚にも復習が <b>{dueOutside}問</b> あります。
              <button onClick={() => changeScope({ shelfIds: [], itemIds: [] })} className="font-bold text-indigo-600 hover:underline">すべての本棚にする</button>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} flex flex-col gap-3 p-5`}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-black text-gray-900">覚えた度</span>
            <span className="truncate pl-2 text-xs text-gray-500">{label} ・ {scoped.length}問</span>
          </div>
          <MasteryBar counts={scopeCounts} total={scoped.length} className="h-4" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MASTERY_ORDER.map(m => (
              <div key={m} className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className={`h-2.5 w-2.5 rounded-full ${MASTERY[m].color}`} />{MASTERY[m].label}</div>
                <div className={`text-xl font-black ${MASTERY[m].text}`}>{scopeCounts[m]}<span className="ml-0.5 text-xs font-normal text-gray-400">問</span></div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">
            復習で正解するたびに1段階上がり（同じ日に何度正解しても1段階だけ）、{Math.max(1, steps - 1)}段階目で「覚えた」になります。まちがえると最初からです。
          </p>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="mb-3 text-sm font-black text-gray-900">本棚ごとの進み具合</h2>
          <ul className="flex flex-col gap-3">
            {qTree.map(s => {
              const ids = quizzes.filter(q => q.shelf_id === s.id).map(q => q.id)
              const c = countMastery(ids, progressMap, steps)
              return (
                <li key={s.id}>
                  <button onClick={() => changeScope({ shelfIds: [s.id], itemIds: [] })} className="w-full text-left" title="この本棚を学習する">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-bold text-gray-800 hover:text-indigo-700">📚 {s.name}</span>
                      <span className="shrink-0 text-xs text-gray-500">
                        覚えた <b className="text-emerald-600">{Math.round((c.mastered / Math.max(1, ids.length)) * 100)}%</b> ・ {ids.length}問
                      </span>
                    </div>
                    <MasteryBar counts={c} total={ids.length} className="h-2" />
                  </button>
                  {s.items.length > 1 && (
                    <ul className="mt-1.5 flex flex-col gap-1 pl-4">
                      {s.items.map(i => {
                        const iids = quizzes.filter(q => q.item_id === i.id).map(q => q.id)
                        const ic = countMastery(iids, progressMap, steps)
                        return (
                          <li key={i.id}>
                            <button onClick={() => changeScope({ shelfIds: [], itemIds: [i.id] })} className="flex w-full items-center gap-2 text-left text-xs" title="このアイテムを学習する">
                              <span className="w-32 shrink-0 truncate text-gray-600 hover:text-indigo-700 sm:w-40">{i.title}</span>
                              <MasteryBar counts={ic} total={iids.length} className="h-1.5" />
                              <span className="w-10 shrink-0 text-right text-gray-400">{iids.length}問</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[11px] text-gray-400">本棚やアイテムを押すと、そこを学習する範囲にします。</p>
        </section>
      </div>

      <section className={`${card} p-5`}>
        <h2 className="mb-3 text-sm font-black text-gray-900">最近の記録</h2>
        {sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">まだ記録がありません。クイズで遊ぶか学習すると、ここに残ります。</p>
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

      {session && (
        <StudySession
          key={session.key}
          title={session.title}
          reviews={session.reviews}
          fresh={session.fresh}
          settings={current}
          more={moreFor(session)}
          onClose={() => { setSession(null); router.refresh() }}
        />
      )}
      {reminderDialog}
      {editingSettings && (
        <StudySettingsDialog
          value={current}
          onClose={() => setEditingSettings(false)}
          onSaved={() => { setEditingSettings(false); router.refresh() }}
        />
      )}
    </div>
  )
}
