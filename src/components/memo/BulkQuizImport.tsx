'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BULK_DEFAULT_ORDER, BULK_FIELD_LABELS, BULK_TEMPLATE, parseBulkQuiz } from '@/lib/quiz'
import { btn, input } from '@/lib/ui'
import { DifficultyBadge } from '@/components/quiz/Difficulty'
import { QuizImage } from '@/components/quiz/QuizImage'

export interface ExistingQuiz { id: string; question: string | null; answer: string | null }

const quizKey = (q: string | null, a: string | null) => `${(q ?? '').normalize('NFKC').trim()}\u0000${(a ?? '').normalize('NFKC').trim()}`

export default function BulkQuizImport({ itemId, existing, onDone }: { itemId: string; existing: ExistingQuiz[]; onDone: () => void }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [reorder, setReorder] = useState(true)

  const { rows, order, hasHeader } = parseBulkQuiz(text)

  // 問題文と答えが同じものは、すでにある問題とみなして追加しない
  const pool = new Map<string, string[]>()
  for (const e of existing) {
    const k = quizKey(e.question, e.answer)
    pool.set(k, [...(pool.get(k) ?? []), e.id])
  }
  const matched = rows.map(r => pool.get(quizKey(r.question, r.answer))?.shift() ?? null)
  const newRows = rows.filter((_, i) => matched[i] === null)
  const dupCount = rows.length - newRows.length
  const willReorder = reorder && dupCount > 0

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(BULK_TEMPLATE)
      setStatus({ kind: 'info', msg: '見出し行をコピーしました。スプレッドシートの1行目に貼り付けてください。' })
    } catch {
      setStatus({ kind: 'error', msg: 'コピーできませんでした。' })
    }
  }

  async function importRows() {
    if (newRows.length === 0 && !willReorder) return
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); return }
    let newIds: string[] = []
    if (newRows.length > 0) {
      const { data, error } = await supabase.from('memos').insert(
        newRows.map(r => ({
          item_id: itemId,
          user_id: user.id,
          type: 'qa' as const,
          question: r.question,
          answer: r.answer,
          explanation: r.explanation,
          difficulty: r.difficulty,
          tags: r.tags,
          image_url: r.image_url,
        })),
      ).select('id')
      if (error) {
        setBusy(false)
        setStatus({ kind: 'error', msg: `追加できませんでした: ${error.message}` })
        return
      }
      newIds = (data ?? []).map(d => d.id)
    }
    if (willReorder) {
      // 貼り付けた表の上からの順に、すでにある問題も新しい問題も並べ直す
      let n = 0
      const ids = matched.map(id => id ?? newIds[n++]).filter((id): id is string => !!id)
      const { error } = await supabase.rpc('reorder_quizzes', { p_ids: ids })
      if (error) {
        setBusy(false)
        setStatus({ kind: 'error', msg: `並び順をそろえられませんでした: ${error.message}` })
        router.refresh()
        return
      }
    }
    setBusy(false)
    setText('')
    setStatus(null)
    onDone()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-indigo-50/60 p-3 text-xs leading-relaxed text-gray-600">
        <p>
          Googleスプレッドシートで範囲を選んでコピーし、下に貼り付けてください。<b>1行 = 1問</b>です。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-gray-500">列の並び：</span>
          {BULK_DEFAULT_ORDER.map((f, i) => (
            <span key={f} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-gray-300">│</span>}
              <span className={`rounded px-1.5 py-0.5 ${f === 'question' || f === 'answer' ? 'bg-white font-semibold text-indigo-700' : 'bg-white/60 text-gray-600'}`}>
                {BULK_FIELD_LABELS[f]}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-gray-500">
          問題・答え以外は空欄でOK。1行目に「問題」「答え」などの見出しがあれば、列の順番は自由です。難易度は 1〜5 / ★の数 / かんたん・ふつう・むずかしい で書けます。画像は https:// で始まる画像のURLを入れるとビジュアルクイズになります。
        </p>
        <button type="button" onClick={copyTemplate} className="mt-2 text-indigo-600 underline-offset-2 hover:underline">
          📋 見出し行をコピー
        </button>
      </div>

      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setStatus(null) }}
        placeholder={'北海道の県庁所在地は？\t札幌\t北海道\t1\t道庁は札幌市中央区にある\n日本の祝日で最も新しいのは？\t山の日\t祝日 生活\t3'}
        rows={6}
        className={`${input} font-mono text-xs`}
      />

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">問題</th>
                <th className="px-2 py-1.5 text-left font-medium">答え</th>
                <th className="px-2 py-1.5 text-left font-medium">ジャンル</th>
                <th className="px-2 py-1.5 text-left font-medium">難易度</th>
                <th className="px-2 py-1.5 text-left font-medium">解説</th>
                <th className="px-2 py-1.5 text-left font-medium">画像</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  <td className="max-w-56 truncate px-2 py-1.5">{r.question}</td>
                  <td className="max-w-40 truncate px-2 py-1.5 font-medium">{r.answer}</td>
                  <td className="px-2 py-1.5 text-indigo-600">{r.tags.map(t => `#${t}`).join(' ')}</td>
                  <td className="px-2 py-1.5"><DifficultyBadge level={r.difficulty} /></td>
                  <td className="max-w-40 truncate px-2 py-1.5 text-gray-500">{r.explanation}</td>
                  <td className="px-2 py-1.5">{r.image_url && <QuizImage src={r.image_url} className="h-8 w-12 rounded object-cover" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
            {rows.length > 5 && `ほか ${rows.length - 5}問 ・ `}
            {hasHeader ? `見出し行を検出（${order.map(f => BULK_FIELD_LABELS[f]).join('・')}）` : '見出しなし（標準の並びで読み込み）'}
          </div>
        </div>
      )}

      {dupCount > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>このアイテムにすでにある問題（問題文と答えが同じ）が <b>{dupCount}問</b> あります。これらは追加しません。</span>
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={reorder} onChange={e => setReorder(e.target.checked)} className="accent-indigo-600" />
            並び順もこの表の上からの順にそろえる（成績はそのまま。「初めから学習」の順番になります）
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={importRows} disabled={(newRows.length === 0 && !willReorder) || busy} className={btn.primary}>
          {busy
            ? '保存中…'
            : newRows.length > 0
              ? `${newRows.length}問を追加${willReorder ? '・並び順をそろえる' : ''}`
              : willReorder ? `並び順をそろえる（${dupCount}問）` : rows.length > 0 ? '追加する問題がありません' : '0問を追加'}
        </button>
        {status && (
          <span className={`text-xs ${status.kind === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{status.msg}</span>
        )}
      </div>
    </div>
  )
}
