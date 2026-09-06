'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Item, Memo, MemoType } from '@/types'
import ReviewModal from '@/components/ReviewModal'

const TYPE_LABELS: Record<MemoType, string> = {
  quote: '📌 引用', thought: '💡 自分の考え', qa: '❓ 一問一答',
}
const TYPE_COLORS: Record<MemoType, string> = {
  quote: 'bg-yellow-50 border-yellow-200',
  thought: 'bg-green-50 border-green-200',
  qa: 'bg-violet-50 border-violet-200',
}
const BADGE_COLORS: Record<MemoType, string> = {
  quote: 'bg-yellow-100 text-yellow-800',
  thought: 'bg-green-100 text-green-800',
  qa: 'bg-violet-100 text-violet-800',
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
  const [showReview, setShowReview] = useState(false)

  const allTags = [...new Set(memos.flatMap(m => m.tags ?? []))].sort()
  const filtered = activeTag ? memos.filter(m => m.tags?.includes(activeTag)) : memos

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

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
              {item.source_type === 'book' ? '📖 本' : item.source_type === 'youtube' ? '▶️ YouTube' : item.source_type === 'web' ? '🌐 Web' : '📄 その他'}
            </span>
            {item.title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            {item.author && <span>{item.author}</span>}
            {item.url && <a href={item.url} target="_blank" className="text-blue-500 hover:underline">🔗 リンクを開く</a>}
          </div>
        </div>
        <button
          onClick={() => setShowReview(true)}
          className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-md hover:bg-violet-700 whitespace-nowrap"
        >
          🔁 復習
        </button>
      </div>

      {/* メモ入力 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100 flex-wrap">
          <span className="text-xs text-gray-400 mr-1">種別：</span>
          {(['quote', 'thought', 'qa'] as MemoType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${tab === t ? BADGE_COLORS[t] + ' border-transparent' : 'border-gray-200 text-gray-400'}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'qa' ? (
          <div className="flex flex-col gap-2 mb-3">
            <label className="text-xs text-gray-400">Q（問い）</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="例：習慣化に最も重要なことは？" rows={2}
              className="text-sm px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-blue-400 resize-none font-sans" />
            <label className="text-xs text-gray-400">A（答え）</label>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="例：小さく始めて継続すること" rows={2}
              className="text-sm px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-blue-400 resize-none font-sans" />
          </div>
        ) : (
          <textarea value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addMemo() } }}
            placeholder="メモを入力… (Ctrl+Enter で追加)"
            rows={3}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-blue-400 resize-none font-sans mb-3" />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            placeholder="タグ（カンマ区切り、任意）"
            className="flex-1 min-w-36 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md outline-none focus:border-indigo-400" />
          <span className="text-xs text-gray-400">Ctrl+Enter で追加</span>
          <button onClick={addMemo} className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600">追加</button>
        </div>
      </div>

      {/* タグフィルター */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="text-xs border border-gray-200 rounded-full px-2.5 py-0.5 hover:bg-gray-50">✕ クリア</button>
          )}
          {allTags.map(t => (
            <span
              key={t}
              onClick={() => setActiveTag(t === activeTag ? null : t)}
              className={`text-xs px-2.5 py-0.5 rounded-full border cursor-pointer transition-all ${t === activeTag ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}
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
        <div className="flex flex-col gap-2.5">
          {filtered.map(m => (
            <div key={m.id} className={`rounded-lg border p-3.5 text-sm ${TYPE_COLORS[m.type]}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_COLORS[m.type]}`}>
                  {TYPE_LABELS[m.type]}
                </span>
                <button onClick={() => deleteMemo(m.id)} className="text-xs text-red-400 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50">削除</button>
              </div>

              {m.type === 'qa' ? (
                <QACard question={m.question!} answer={m.answer!} />
              ) : (
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
              )}

              {m.tags && m.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {m.tags.map(t => (
                    <span key={t} onClick={() => setActiveTag(t)} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 cursor-pointer hover:bg-indigo-100">#{t}</span>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-300 mt-2">{new Date(m.created_at).toLocaleDateString('ja-JP')}</div>
            </div>
          ))}
        </div>
      )}

      {showReview && <ReviewModal memos={memos} onClose={() => setShowReview(false)} />}
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
      {open && <p className="mt-2 bg-white/70 rounded px-2.5 py-2 leading-relaxed">A: {answer}</p>}
    </div>
  )
}
