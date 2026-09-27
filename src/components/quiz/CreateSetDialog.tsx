'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { QuizSet } from '@/types'
import { shuffle } from '@/lib/quiz'
import { btn, input, label } from '@/lib/ui'
import CountPicker from './CountPicker'

type Mode = 'new' | 'existing'
type Pick = 'random' | 'top'

export default function CreateSetDialog({
  quizIds,
  sourceLabel,
  defaultTitle,
  authorName,
  mySets,
  onClose,
  onAdded,
}: {
  quizIds: string[]
  sourceLabel: string
  defaultTitle: string
  authorName: string
  mySets: QuizSet[]
  onClose: () => void
  onAdded: (message: string) => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('new')
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [targetSetId, setTargetSetId] = useState(mySets[0]?.id ?? '')
  const [count, setCount] = useState(quizIds.length)
  const [pick, setPick] = useState<Pick>('random')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const partial = count < quizIds.length

  function chooseIds() {
    if (!partial) return quizIds
    return pick === 'random' ? shuffle(quizIds).slice(0, count) : quizIds.slice(0, count)
  }

  async function submit() {
    setError(null)
    if (mode === 'new' && !title.trim()) { setError('セット名を入力してください。'); return }
    if (mode === 'existing' && !targetSetId) { setError('追加先のセットを選んでください。'); return }
    setBusy(true)
    const supabase = createClient()
    const ids = chooseIds()

    if (mode === 'new') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setBusy(false); return }
      const { data: set, error: insertSetError } = await supabase
        .from('quiz_sets')
        .insert({ user_id: user.id, title: title.trim(), description: description.trim() || null, author_name: authorName, is_public: isPublic })
        .select('id')
        .single()
      if (insertSetError || !set) {
        setBusy(false)
        setError(`作成できませんでした: ${insertSetError?.message ?? ''}`)
        return
      }
      const { error: itemsError } = await supabase
        .from('quiz_set_items')
        .insert(ids.map((memo_id, position) => ({ quiz_set_id: set.id, memo_id, position })))
      if (itemsError) {
        await supabase.from('quiz_sets').delete().eq('id', set.id)
        setBusy(false)
        setError(`作成できませんでした: ${itemsError.message}`)
        return
      }
      router.push(`/quiz/sets/${set.id}`)
      return
    }

    const { data: last } = await supabase
      .from('quiz_set_items')
      .select('position')
      .eq('quiz_set_id', targetSetId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const start = (last?.position ?? -1) + 1
    const { data: added, error: addError } = await supabase
      .from('quiz_set_items')
      .upsert(
        ids.map((memo_id, i) => ({ quiz_set_id: targetSetId, memo_id, position: start + i })),
        { onConflict: 'quiz_set_id,memo_id', ignoreDuplicates: true },
      )
      .select('memo_id')
    setBusy(false)
    if (addError) { setError(`追加できませんでした: ${addError.message}`); return }
    const n = added?.length ?? 0
    const skipped = ids.length - n
    const setTitle = mySets.find(s => s.id === targetSetId)?.title ?? 'セット'
    onAdded(`「${setTitle}」に${n}問追加しました${skipped > 0 ? `（すでに入っていた${skipped}問はスキップ）` : ''}`)
    router.refresh()
    onClose()
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">クイズセットにする</h2>
        <p className="mt-1 text-sm text-gray-500">{sourceLabel} <b className="text-gray-800">{quizIds.length}問</b> から選びます。</p>

        <div className="mt-4 flex rounded-xl bg-gray-100 p-1">
          <button type="button" onClick={() => setMode('new')} className={tabClass(mode === 'new')}>新しいセット</button>
          <button type="button" onClick={() => setMode('existing')} disabled={mySets.length === 0}
            className={`${tabClass(mode === 'existing')} disabled:opacity-40`} title={mySets.length === 0 ? 'まだセットがありません' : undefined}>
            既存のセットに追加
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {mode === 'new' ? (
            <>
              <label className="flex flex-col gap-1">
                <span className={label}>セット名</span>
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)} className={input} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={label}>説明 <span className="font-normal text-gray-400">（任意）</span></span>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${input} resize-none`} />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1">
              <span className={label}>追加先</span>
              <select value={targetSetId} onChange={e => setTargetSetId(e.target.value)} className={input}>
                {mySets.map(s => <option key={s.id} value={s.id}>{s.title}（{s.quiz_count}問）</option>)}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <span className={label}>問題数</span>
            <CountPicker max={quizIds.length} value={count} onChange={setCount} />
            {partial && (
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <label className="inline-flex cursor-pointer items-center gap-1">
                  <input type="radio" checked={pick === 'random'} onChange={() => setPick('random')} className="accent-indigo-600" />
                  ランダムに{count}問
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1">
                  <input type="radio" checked={pick === 'top'} onChange={() => setPick('top')} className="accent-indigo-600" />
                  一覧の上から{count}問
                </label>
              </div>
            )}
          </div>

          {mode === 'new' && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="mt-0.5 accent-indigo-600" />
              <span>
                <span className="block text-sm font-medium">みんなに公開する</span>
                <span className="block text-xs text-gray-500">「みんなのセット」に表示され、リンクを知っている人はログインなしで遊べます。あとから変更できます。</span>
              </span>
            </label>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={btn.secondary}>キャンセル</button>
            <button onClick={submit} disabled={busy || quizIds.length === 0} className={btn.primary}>
              {busy ? '保存中…' : mode === 'new' ? `${count}問のセットを作成` : `${count}問を追加`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
