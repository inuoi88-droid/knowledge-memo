'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Item, Memo, MemoType, Quiz } from '@/types'
import { useDensity } from '@/lib/density'
import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS, toQuiz } from '@/lib/quiz'
import { btn, card, chip } from '@/lib/ui'
import AddMemoForm, { TYPE_LABELS } from '@/components/memo/AddMemoForm'
import EditMemoForm from '@/components/memo/EditMemoForm'
import QuizRow from '@/components/quiz/QuizRow'
import QuizPlayer from '@/components/quiz/QuizPlayer'
import DensityToggle from '@/components/quiz/DensityToggle'

const NOTE_STYLE: Record<Exclude<MemoType, 'qa'>, { bar: string; badge: string }> = {
  quote: { bar: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-800' },
  thought: { bar: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
}

type Filter = 'all' | MemoType

export default function MemoDetail({ item, memos }: { item: Item; memos: Memo[] }) {
  const router = useRouter()
  const density = useDensity()

  const [filter, setFilter] = useState<Filter>('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [revealAll, setRevealAll] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [playGenre, setPlayGenre] = useState('')
  const [playDifficulty, setPlayDifficulty] = useState('')
  const [playing, setPlaying] = useState<Quiz[] | null>(null)

  const quizMemos = memos.filter(m => m.type === 'qa')
  const noteMemos = memos.filter(m => m.type !== 'qa')
  const allTags = [...new Set(memos.flatMap(m => m.tags ?? []))].sort()
  const quizTags = [...new Set(quizMemos.flatMap(m => m.tags ?? []))].sort()

  const byTag = (m: Memo) => !activeTag || m.tags?.includes(activeTag)
  const visibleQuizzes = filter === 'all' || filter === 'qa' ? quizMemos.filter(byTag) : []
  const visibleNotes = noteMemos.filter(m => (filter === 'all' || filter === m.type) && byTag(m))

  const playPool = quizMemos.filter(m =>
    (!playGenre || m.tags?.includes(playGenre)) &&
    (!playDifficulty || String(m.difficulty ?? '') === playDifficulty),
  )

  async function deleteMemo(id: string) {
    if (!confirm('このメモを削除しますか？')) return
    await createClient().from('memos').delete().eq('id', id)
    router.refresh()
  }

  const rowActions = (m: Memo) => (
    <>
      <button onClick={() => setEditingId(m.id)} className={btn.ghost}>編集</button>
      <button onClick={() => deleteMemo(m.id)} className={btn.danger}>削除</button>
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{item.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            {item.author && <span>{item.author}</span>}
            {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">リンクを開く ↗</a>}
          </div>
        </div>

        {quizMemos.length > 0 && (
          <div className={`${card} flex flex-wrap items-center gap-2 p-2`}>
            <select value={playGenre} onChange={e => setPlayGenre(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-400">
              <option value="">すべてのジャンル</option>
              {quizTags.map(t => <option key={t} value={t}>#{t}</option>)}
            </select>
            <select value={playDifficulty} onChange={e => setPlayDifficulty(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-400">
              <option value="">すべての難易度</option>
              {DIFFICULTY_LEVELS.map(l => <option key={l} value={l}>{'★'.repeat(l)} {DIFFICULTY_LABELS[l]}</option>)}
            </select>
            <button onClick={() => setPlaying(playPool.map(toQuiz))} disabled={playPool.length === 0} className={btn.small}>
              ▶ クイズに挑戦 ({playPool.length}問)
            </button>
          </div>
        )}
      </div>

      <AddMemoForm itemId={item.id} />

      {/* 絞り込み */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'qa', 'quote', 'thought'] as Filter[]).map(f => {
          const count = f === 'all' ? memos.length : memos.filter(m => m.type === f).length
          return (
            <button key={f} onClick={() => setFilter(f)} className={chip(filter === f)}>
              {f === 'all' ? 'すべて' : TYPE_LABELS[f]} <span className="opacity-70">{count}</span>
            </button>
          )
        })}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {visibleQuizzes.length > 0 && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
              <input type="checkbox" checked={revealAll} onChange={e => setRevealAll(e.target.checked)} className="accent-indigo-600" />
              答えをすべて表示
            </label>
          )}
          <DensityToggle />
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400">ジャンル・タグ：</span>
          {allTags.map(t => (
            <button key={t} onClick={() => setActiveTag(t === activeTag ? null : t)} className={chip(t === activeTag)}>#{t}</button>
          ))}
        </div>
      )}

      {memos.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">まだメモがありません。上のフォームからクイズやメモを追加しましょう。</p>
      )}

      {visibleQuizzes.length > 0 && (
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-gray-100 bg-indigo-50/50 px-4 py-2">
            <span className="text-xs font-semibold text-indigo-700">クイズ {visibleQuizzes.length}問</span>
          </div>
          <div className="divide-y divide-gray-100">
            {visibleQuizzes.map(m =>
              editingId === m.id ? (
                <EditMemoForm key={m.id} memo={m} onDone={() => setEditingId(null)} />
              ) : (
                <QuizRow
                  key={m.id}
                  quiz={toQuiz(m)}
                  density={density}
                  revealAll={revealAll}
                  onTagClick={setActiveTag}
                  actions={rowActions(m)}
                />
              ),
            )}
          </div>
        </section>
      )}

      {visibleNotes.length > 0 && (
        <section className="flex flex-col gap-2">
          {visibleNotes.map(m => {
            const style = NOTE_STYLE[m.type as Exclude<MemoType, 'qa'>]
            return editingId === m.id ? (
              <div key={m.id} className={`${card} overflow-hidden`}>
                <EditMemoForm memo={m} onDone={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={m.id} className={`${card} border-l-4 ${style.bar} ${density === 'compact' ? 'px-3 py-2' : density === 'large' ? 'px-5 py-4' : 'px-4 py-3'}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.badge}`}>{TYPE_LABELS[m.type]}</span>
                  <p className={`min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed ${density === 'large' ? 'text-base' : 'text-sm'}`}>{m.text}</p>
                  <div className="flex shrink-0 items-center">{rowActions(m)}</div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-1">
                  {m.tags?.map(t => (
                    <button key={t} onClick={() => setActiveTag(t)} className="text-xs text-indigo-600 hover:underline">#{t}</button>
                  ))}
                  <span className="ml-auto text-[11px] text-gray-300">{new Date(m.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {playing && (
        <QuizPlayer
          quizzes={playing}
          title={[item.title, playGenre && `#${playGenre}`, playDifficulty && '★'.repeat(Number(playDifficulty))].filter(Boolean).join(' ')}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  )
}
