'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Memo } from '@/types'
import { parseTags } from '@/lib/quiz'
import { btn, input, label } from '@/lib/ui'
import { DifficultyPicker } from '@/components/quiz/Difficulty'

export default function EditMemoForm({ memo, onDone }: { memo: Memo; onDone: () => void }) {
  const router = useRouter()
  const [text, setText] = useState(memo.text ?? '')
  const [question, setQuestion] = useState(memo.question ?? '')
  const [answer, setAnswer] = useState(memo.answer ?? '')
  const [explanation, setExplanation] = useState(memo.explanation ?? '')
  const [difficulty, setDifficulty] = useState<number | null>(memo.difficulty ?? null)
  const [tagInput, setTagInput] = useState((memo.tags ?? []).join(' '))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isQuiz = memo.type === 'qa'

  async function save() {
    setError(null)
    const tags = parseTags(tagInput)
    let updates: Record<string, unknown>
    if (isQuiz) {
      if (!question.trim() || !answer.trim()) { setError('問題と答えの両方を入力してください。'); return }
      updates = { question: question.trim(), answer: answer.trim(), explanation: explanation.trim() || null, difficulty, tags }
    } else {
      if (!text.trim()) { setError('内容を入力してください。'); return }
      updates = { text: text.trim(), tags }
    }
    setBusy(true)
    const { error: updateError } = await createClient().from('memos').update(updates).eq('id', memo.id)
    setBusy(false)
    if (updateError) { setError(`保存できませんでした: ${updateError.message}`); return }
    onDone()
    router.refresh()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save() }
    if (e.key === 'Escape') onDone()
  }

  return (
    <div className="flex flex-col gap-3 bg-indigo-50/40 p-4" onKeyDown={onKey}>
      {isQuiz ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <label className="flex flex-col gap-1">
              <span className={label}>問題</span>
              <textarea autoFocus value={question} onChange={e => setQuestion(e.target.value)} rows={2} className={`${input} resize-none`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>答え</span>
              <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={2} className={`${input} resize-none`} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className={label}>解説</span>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} className={`${input} resize-none`} />
          </label>
          <div className="flex flex-col gap-1">
            <span className={label}>難易度</span>
            <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          </div>
        </>
      ) : (
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3} className={`${input} resize-none`} />
      )}
      <label className="flex flex-col gap-1">
        <span className={label}>{isQuiz ? 'ジャンル' : 'タグ'}</span>
        <input value={tagInput} onChange={e => setTagInput(e.target.value)} className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={busy} className={btn.primary}>{busy ? '保存中…' : '保存'}</button>
        <button onClick={onDone} className={btn.secondary}>キャンセル</button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  )
}
