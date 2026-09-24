'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Item, Memo, MemoType } from '@/types'
import ReviewModal from '@/components/ReviewModal'

const TYPE_LABELS: Record<MemoType, string> = {
  quote: '引用', thought: '自分の考え', qa: '一問一答',
}
const TYPE_COLORS: Record<MemoType, string> = {
  quote: 'bg-amber-50 border-amber-200',
  thought: 'bg-emerald-50 border-emerald-200',
  qa: 'bg-violet-50 border-violet-200',
}
const BADGE_COLORS: Record<MemoType, string> = {
  quote: 'bg-amber-100 text-amber-800',
  thought: 'bg-emerald-100 text-emerald-800',
  qa: 'bg-violet-100 text-violet-800',
}

// Googleスプレッドシートから「質問<Tab>回答<Tab>タグ(任意)」をコピーしてそのまま貼り付けられる形式
const BULK_HEADER_Q = ['question', 'q', '質問', '問題', '問い']
const BULK_HEADER_A = ['answer', 'a', '回答', '答え']

function parseBulkQA(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map(line => line.split('\t').map(cell => cell.trim()))
    .filter(cols => cols.length >= 2 && cols[0] && cols[1])

  if (rows.length > 0 && BULK_HEADER_Q.includes(rows[0][0].toLowerCase()) && BULK_HEADER_A.includes(rows[0][1].toLowerCase())) {
    rows.shift()
  }

  return rows.map(cols => ({
    question: cols[0],
    answer: cols[1],
    tags: cols[2] ? cols[2].split(/[,、\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean) : [],
  }))
}

export default function MemoDetail({ item, memos }: { item: Item; memos: Memo[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<MemoType>('quote')
  const [text, setText] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [reviewTag, setReviewTag] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editTagInput, setEditTagInput] = useState('')

  const allTags = [...new Set(memos.flatMap(m => m.tags ?? []))].sort()
  const filtered = activeTag ? memos.filter(m => m.tags?.includes(activeTag)) : memos

  // 復習対象：タグ選択があればそのタグのQAのみ、なければ全QA
  const reviewMemos = memos.filter(m =>
    m.type === 'qa' && (reviewTag === null || m.tags?.includes(reviewTag))
  )

  async function addMemo() {
    const tags = tagInput.trim()
      ? tagInput.split(/[,、\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
      : []

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (tab === 'qa') {
      if (!question.trim() || !answer.trim()) { alert('Q と A の両方を入力してください。'); return }
      await supabase.from('memos').insert({ item_id: item.id, user_id: user.id, type: 'qa', question: question.trim(), answer: answer.trim(), tags })
      setQuestion(''); setAnswer('')
    } else {
      if (!text.trim()) return
      await supabase.from('memos').insert({ item_id: item.id, user_id: user.id, type: tab, text: text.trim(), tags })
      setText('')
    }
    setTagInput('')
    router.refresh()
  }

  async function deleteMemo(id: string) {
    await supabase.from('memos').delete().eq('id', id)
    router.refresh()
  }

  function startEditMemo(m: Memo) {
    setEditingMemoId(m.id)
    setEditText(m.text ?? '')
    setEditQuestion(m.question ?? '')
    setEditAnswer(m.answer ?? '')
    setEditTagInput((m.tags ?? []).join(' '))
  }

  async function saveEditMemo(m: Memo) {
    const tags = editTagInput.trim()
      ? editTagInput.split(/[,、\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
      : []

    const updates = m.type === 'qa'
      ? (() => {
          if (!editQuestion.trim() || !editAnswer.trim()) { alert('Q と A の両方を入力してください。'); return null }
          return { question: editQuestion.trim(), answer: editAnswer.trim(), tags }
        })()
      : (() => {
          if (!editText.trim()) { alert('内容を入力してください。'); return null }
          return { text: editText.trim(), tags }
        })()

    if (!updates) return

    const { error } = await supabase.from('memos').update(updates).eq('id', m.id)
    if (!error) {
      setEditingMemoId(null)
      router.refresh()
    }
  }

  const bulkRows = parseBulkQA(bulkText)

  async function importBulkQA() {
    if (bulkRows.length === 0) {
      setBulkStatus('取り込めるQ&Aが見つかりませんでした。「質問→Tab→回答」の形で貼り付けてください。')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('memos').insert(
      bulkRows.map(r => ({
        item_id: item.id,
        user_id: user.id,
        type: 'qa' as const,
        question: r.question,
        answer: r.answer,
        tags: r.tags,
      }))
    )
    if (error) {
      setBulkStatus(`インポートに失敗しました: ${error.message}`)
      return
    }
    setBulkText('')
    setBulkStatus(null)
    setShowBulkImport(false)
    router.refresh()
  }

  const qaCount = memos.filter(m => m.type === 'qa').length

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-base font-semibold">{item.title}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            {item.author && <span>{item.author}</span>}
            {item.url && <a href={item.url} target="_blank" className="text-blue-500 hover:underline">リンクを開く</a>}
          </div>
        </div>

        {/* 復習ボタン＋タグ選択 */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {qaCount > 0 && (
            <>
              <select
                value={reviewTag ?? ''}
                onChange={e => setReviewTag(e.target.value || null)}
                className="text-xs border border-gray-200 px-2 py-1.5 outline-none focus:border-gray-400 bg-white"
              >
                <option value="">すべてのQA ({qaCount}件)</option>
                {allTags.map(t => {
                  const count = memos.filter(m => m.type === 'qa' && m.tags?.includes(t)).length
                  return count > 0 ? (
                    <option key={t} value={t}>#{t} ({count}件)</option>
                  ) : null
                })}
              </select>
              <button
                onClick={() => setShowReview(true)}
                disabled={reviewMemos.length === 0}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                復習 ({reviewMemos.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* メモ入力 */}
      <div className="bg-white border border-gray-200 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100 flex-wrap">
          <span className="text-xs text-gray-400 mr-1">種別：</span>
          {(['quote', 'thought', 'qa'] as MemoType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs border transition-colors ${tab === t ? BADGE_COLORS[t] + ' border-transparent' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'qa' ? (
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Q（問い）</label>
              <button
                type="button"
                onClick={() => { setShowBulkImport(v => !v); setBulkStatus(null) }}
                className="text-xs text-blue-500 hover:underline"
              >
                {showBulkImport ? '個別入力に戻る' : '📋 スプレッドシートからまとめて貼り付け'}
              </button>
            </div>

            {showBulkImport ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Googleスプレッドシートで「質問」「回答」「タグ（任意・スペース区切り）」の列を選択してコピーし、そのまま下に貼り付けてください。1行が1つのQ&Aになります。
                </p>
                <textarea
                  value={bulkText}
                  onChange={e => { setBulkText(e.target.value); setBulkStatus(null) }}
                  placeholder={'習慣化に最も重要なことは？\t小さく始めて継続すること\t習慣 自己啓発\n複利とは？\t利息が利息を生む仕組み'}
                  rows={6}
                  className="text-sm px-3 py-2 border border-gray-200 outline-none focus:border-gray-400 resize-none font-mono"
                />
                <div className="flex items-center gap-2">
                  <button onClick={importBulkQA} disabled={bulkRows.length === 0}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 disabled:opacity-40 transition-colors">
                    {bulkRows.length}件をインポート
                  </button>
                  {bulkStatus && <span className="text-xs text-red-500">{bulkStatus}</span>}
                </div>
              </div>
            ) : (
              <>
                <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="例：習慣化に最も重要なことは？" rows={2}
                  className="text-sm px-3 py-2 border border-gray-200 outline-none focus:border-gray-400 resize-none font-sans" />
                <label className="text-xs text-gray-400">A（答え）</label>
                <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="例：小さく始めて継続すること" rows={2}
                  className="text-sm px-3 py-2 border border-gray-200 outline-none focus:border-gray-400 resize-none font-sans" />
              </>
            )}
          </div>
        ) : (
          <textarea value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addMemo() } }}
            placeholder="メモを入力… (Ctrl+Enter で追加)"
            rows={3}
            className="w-full text-sm px-3 py-2 border border-gray-200 outline-none focus:border-gray-400 resize-none font-sans mb-3" />
        )}

        {!(tab === 'qa' && showBulkImport) && (
          <div className="flex items-center gap-2 flex-wrap">
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="タグ（カンマ区切り、任意）"
              className="flex-1 min-w-36 text-xs px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400" />
            <span className="text-xs text-gray-400">Ctrl+Enter で追加</span>
            <button onClick={addMemo} className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors">追加</button>
          </div>
        )}
      </div>

      {/* タグフィルター */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="text-xs border border-gray-200 px-2.5 py-0.5 hover:bg-gray-50">✕ クリア</button>
          )}
          {allTags.map(t => (
            <span
              key={t}
              onClick={() => setActiveTag(t === activeTag ? null : t)}
              className={`text-xs px-2.5 py-0.5 border cursor-pointer transition-colors ${t === activeTag ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* メモ一覧 */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">メモがまだありません。</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(m => (
            <div key={m.id} className={`border p-4 text-sm ${TYPE_COLORS[m.type]}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 ${BADGE_COLORS[m.type]}`}>
                  {TYPE_LABELS[m.type]}
                </span>
                {editingMemoId !== m.id && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => startEditMemo(m)} className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 hover:bg-white transition-colors">編集</button>
                    <button onClick={() => deleteMemo(m.id)} className="text-xs text-red-400 border border-red-200 px-2 py-0.5 hover:bg-red-50 transition-colors">削除</button>
                  </div>
                )}
              </div>

              {editingMemoId === m.id ? (
                <div className="flex flex-col gap-2">
                  {m.type === 'qa' ? (
                    <>
                      <label className="text-xs text-gray-400">Q（問い）</label>
                      <textarea value={editQuestion} onChange={e => setEditQuestion(e.target.value)} rows={2}
                        className="text-sm px-3 py-2 border border-gray-200 outline-none focus:border-gray-400 resize-none font-sans bg-white" />
                      <label className="text-xs text-gray-400">A（答え）</label>
                      <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)} rows={2}
                        className="text-sm px-3 py-2 border border-gray-200 outline-none focus:border-gray-400 resize-none font-sans bg-white" />
                    </>
                  ) : (
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                      className="text-sm px-3 py-2 border border-gray-200 outline-none focus:border-gray-400 resize-none font-sans bg-white" />
                  )}
                  <input value={editTagInput} onChange={e => setEditTagInput(e.target.value)}
                    placeholder="タグ（カンマ区切り、任意）"
                    className="text-xs px-2.5 py-1.5 border border-gray-200 outline-none focus:border-gray-400 bg-white" />
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveEditMemo(m)} className="text-xs bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors">保存</button>
                    <button onClick={() => setEditingMemoId(null)} className="text-xs border border-gray-200 px-3 py-1.5 hover:bg-white transition-colors">キャンセル</button>
                  </div>
                </div>
              ) : (
                <>
                  {m.type === 'qa' ? (
                    <QACard question={m.question!} answer={m.answer!} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                  )}

                  {m.tags && m.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {m.tags.map(t => (
                        <span key={t} onClick={() => setActiveTag(t)} className="text-xs bg-white/70 text-gray-600 border border-gray-300 px-2 py-0.5 cursor-pointer hover:bg-white transition-colors">#{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-300 mt-2">{new Date(m.created_at).toLocaleDateString('ja-JP')}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showReview && (
        <ReviewModal
          memos={reviewMemos}
          tagLabel={reviewTag ? `#${reviewTag}` : null}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  )
}

function QACard({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <p className="font-semibold leading-relaxed">Q: {question}</p>
      <button onClick={() => setOpen(v => !v)} className="text-xs text-blue-500 mt-1">
        {open ? '閉じる ▲' : '答えを見る ▼'}
      </button>
      {open && <p className="mt-2 bg-white/70 px-2.5 py-2 leading-relaxed">A: {answer}</p>}
    </div>
  )
}
