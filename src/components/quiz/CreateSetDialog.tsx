'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { shuffle } from '@/lib/quiz'
import { btn, input, label } from '@/lib/ui'

export default function CreateSetDialog({
  quizIds,
  defaultTitle,
  authorName,
  onClose,
}: {
  quizIds: string[]
  defaultTitle: string
  authorName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [limit, setLimit] = useState(0)
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalCount = limit > 0 ? Math.min(limit, quizIds.length) : quizIds.length

  async function create() {
    if (!title.trim()) { setError('セット名を入力してください。'); return }
    setBusy(true)
    setError(null)
    const supabase = createClient()
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

    const ids = limit > 0 ? shuffle(quizIds).slice(0, limit) : quizIds
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">クイズセットを作る</h2>
        <p className="mt-1 text-sm text-gray-500">今の条件に合う {quizIds.length}問 からセットを作ります。</p>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className={label}>セット名</span>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>説明 <span className="font-normal text-gray-400">（任意）</span></span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${input} resize-none`} />
          </label>
          <div className="flex flex-col gap-1">
            <span className={label}>問題数</span>
            <div className="flex flex-wrap gap-1.5">
              {[0, 10, 20, 30, 50].filter(n => n === 0 || n < quizIds.length).map(n => (
                <button key={n} type="button" onClick={() => setLimit(n)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${limit === n ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {n === 0 ? `全部 (${quizIds.length})` : `ランダム${n}問`}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="mt-0.5 accent-indigo-600" />
            <span>
              <span className="block text-sm font-medium">みんなに公開する</span>
              <span className="block text-xs text-gray-500">「みんなのセット」に表示され、リンクを知っている人はログインなしで遊べます。あとから変更できます。</span>
            </span>
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={btn.secondary}>キャンセル</button>
            <button onClick={create} disabled={busy || finalCount === 0} className={btn.primary}>
              {busy ? '作成中…' : `${finalCount}問のセットを作成`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
