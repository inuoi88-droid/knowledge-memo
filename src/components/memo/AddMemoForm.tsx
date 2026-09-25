'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MemoType } from '@/types'
import { parseTags } from '@/lib/quiz'
import { btn, input, label } from '@/lib/ui'
import { DifficultyPicker } from '@/components/quiz/Difficulty'
import BulkQuizImport from './BulkQuizImport'

export const TYPE_LABELS: Record<MemoType, string> = {
  quote: '引用',
  thought: '自分の考え',
  qa: 'クイズ',
}

const TAB_STYLE: Record<MemoType, string> = {
  qa: 'border-indigo-600 bg-indigo-600 text-white',
  quote: 'border-amber-500 bg-amber-500 text-white',
  thought: 'border-emerald-600 bg-emerald-600 text-white',
}

export default function AddMemoForm({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<MemoType>('qa')
  const [bulk, setBulk] = useState(false)

  const [text, setText] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    const tags = parseTags(tagInput)
    let row: Record<string, unknown>
    if (tab === 'qa') {
      if (!question.trim() || !answer.trim()) { setError('問題と答えの両方を入力してください。'); return }
      row = {
        type: 'qa',
        question: question.trim(),
        answer: answer.trim(),
        explanation: explanation.trim() || null,
        difficulty,
        tags,
      }
    } else {
      if (!text.trim()) { setError('内容を入力してください。'); return }
      row = { type: tab, text: text.trim(), tags }
    }

    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); return }
    const { error: insertError } = await supabase.from('memos').insert({ ...row, item_id: itemId, user_id: user.id })
    setBusy(false)
    if (insertError) { setError(`追加できませんでした: ${insertError.message}`); return }

    setText(''); setQuestion(''); setAnswer(''); setExplanation('')
    // 同じジャンル・難易度で続けて追加しやすいよう、タグと難易度は残す
    router.refresh()
  }

  function onCtrlEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(['qa', 'quote', 'thought'] as MemoType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(null) }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              tab === t ? TAB_STYLE[t] : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
        {tab === 'qa' && (
          <button type="button" onClick={() => setBulk(v => !v)} className="ml-auto text-xs font-medium text-indigo-600 hover:underline">
            {bulk ? '← 1問ずつ入力' : '📋 スプレッドシートからまとめて追加'}
          </button>
        )}
      </div>

      {tab === 'qa' && bulk ? (
        <BulkQuizImport itemId={itemId} onDone={() => setBulk(false)} />
      ) : (
        <div className="flex flex-col gap-3">
          {tab === 'qa' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <label className="flex flex-col gap-1">
                  <span className={label}>問題</span>
                  <textarea value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={onCtrlEnter}
                    placeholder="例：北海道の県庁所在地は？" rows={2} className={`${input} resize-none`} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={label}>答え</span>
                  <textarea value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={onCtrlEnter}
                    placeholder="例：札幌" rows={2} className={`${input} resize-none`} />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className={label}>解説 <span className="font-normal text-gray-400">（任意）</span></span>
                <textarea value={explanation} onChange={e => setExplanation(e.target.value)} onKeyDown={onCtrlEnter}
                  placeholder="答えの補足や覚え方など" rows={2} className={`${input} resize-none`} />
              </label>
              <div className="flex flex-col gap-1">
                <span className={label}>難易度</span>
                <DifficultyPicker value={difficulty} onChange={setDifficulty} />
              </div>
            </>
          ) : (
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={onCtrlEnter}
              placeholder={tab === 'quote' ? '印象に残った一文など' : '考えたこと・気づき'} rows={3}
              className={`${input} resize-none`} />
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className={label}>{tab === 'qa' ? 'ジャンル' : 'タグ'} <span className="font-normal text-gray-400">（スペース・カンマ区切り）</span></span>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={onCtrlEnter}
                placeholder={tab === 'qa' ? '例：北海道 地理' : '例：習慣'} className={input} />
            </label>
            <button onClick={submit} disabled={busy} className={btn.primary}>
              {busy ? '追加中…' : '追加'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            {error ? <span className="text-xs text-red-500">{error}</span> : <span />}
            <span className="text-[11px] text-gray-400">Ctrl + Enter でも追加できます</span>
          </div>
        </div>
      )}
    </div>
  )
}
