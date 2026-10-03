'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { QuizSource } from '@/types'
import { sourceHref } from '@/lib/scope'
import { btn, input, label } from '@/lib/ui'

// 本棚・アイテムの中のクイズをまとめて公開する
export default function PublishButton({
  source,
  name,
  quizCount,
  isPublic,
  authorName,
  defaultAuthor,
  publicShelf,
}: {
  source: QuizSource
  name: string
  quizCount: number
  isPublic: boolean
  authorName: string | null
  defaultAuthor: string
  // アイテムが入っている本棚ごと公開されている場合
  publicShelf?: { id: string; name: string } | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [author, setAuthor] = useState(authorName || defaultAuthor)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const kindLabel = source.kind === 'shelf' ? '本棚' : 'アイテム'

  if (publicShelf) {
    return (
      <Link href={sourceHref({ kind: 'shelf', id: publicShelf.id })}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
        title={`本棚「${publicShelf.name}」ごと公開しています`}>
        🌏 本棚ごと公開中
      </Link>
    )
  }

  async function update(next: boolean) {
    setBusy(true)
    setError(null)
    const { error: err } = await createClient()
      .from(source.kind === 'shelf' ? 'shelves' : 'items')
      .update(next
        ? { is_public: true, author_name: author.trim().slice(0, 40) || null, published_at: new Date().toISOString() }
        : { is_public: false })
      .eq('id', source.id)
    setBusy(false)
    if (err) { setError(`変更できませんでした: ${err.message}`); return }
    router.refresh()
    if (!next) setOpen(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${location.origin}${sourceHref(source)}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={isPublic
          ? 'inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
          : btn.secondary}
      >
        {isPublic ? '🌏 公開中' : '🌏 公開する'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">🌏 {isPublic ? '公開中' : `${kindLabel}を公開する`}</h2>
            <p className="mt-1 truncate text-sm text-gray-500">「{name}」のクイズ <b className="text-gray-800">{quizCount}問</b></p>

            {isPublic ? (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input readOnly value={`${typeof location === 'undefined' ? '' : location.origin}${sourceHref(source)}`} className={`${input} text-xs`} onFocus={e => e.target.select()} />
                  <button onClick={copyLink} className={`${btn.primary} shrink-0`}>{copied ? '✓ コピー' : 'コピー'}</button>
                </div>
                <p className="text-xs text-gray-500">リンクを知っている人は、ログインなしで遊べます。「🌏 みんなの」にも表示されています。</p>
                <div className="flex flex-wrap justify-between gap-2">
                  <Link href={sourceHref(source)} className={btn.secondary}>公開ページを見る</Link>
                  <button onClick={() => update(false)} disabled={busy} className={btn.danger}>{busy ? '変更中…' : '非公開にする'}</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <ul className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                  <li>・この{kindLabel}に入っている<b>クイズがすべて</b>公開されます。あとから追加したクイズも自動で公開されます。</li>
                  <li>・引用・感想のメモは公開されません。</li>
                  <li>・リンクを知っている人はログインなしで遊べ、「🌏 みんなの」にも表示されます。</li>
                  <li>・いつでも非公開に戻せます。</li>
                </ul>
                <label className="flex flex-col gap-1">
                  <span className={label}>作者名（公開ページに表示）</span>
                  <input value={author} onChange={e => setAuthor(e.target.value)} maxLength={40} className={input} />
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className={btn.secondary}>キャンセル</button>
                  <button onClick={() => update(true)} disabled={busy} className={btn.primary}>{busy ? '公開中…' : '公開する'}</button>
                </div>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </>
  )
}
