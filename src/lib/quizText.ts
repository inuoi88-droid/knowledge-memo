import { useCallback, useRef, useState } from 'react'
import type { Quiz } from '@/types'
import type { Session } from './play'
import { createClient } from './supabase/client'

// 問題文・解説は必要になったときに読み込む（quizPack.ts を参照）

export interface QuizText { question: string; explanation: string | null }

const EMPTY: QuizText = { question: '', explanation: null }
// URL が長くなりすぎないよう、ID はこの件数ずつに分けて問い合わせる
const CHUNK = 150

async function fetchQuizTexts(ids: readonly string[]): Promise<Map<string, QuizText>> {
  const supabase = createClient()
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))
  const results = await Promise.all(chunks.map(c => supabase.from('memos').select('id, question, explanation').in('id', c)))
  const found = new Map<string, QuizText>()
  for (const r of results) {
    if (r.error) throw new Error(r.error.message)
    for (const row of r.data ?? []) found.set(row.id, { question: row.question ?? '', explanation: row.explanation ?? null })
  }
  return found
}

export function withText<T extends Quiz>(q: T, texts: ReadonlyMap<string, QuizText>): T {
  const t = texts.get(q.id)
  return t ? { ...q, ...t } : q
}

export function withSessionTexts(s: Session, texts: ReadonlyMap<string, QuizText>): Session {
  return { ...s, items: s.items.map(i => ({ ...i, quiz: withText(i.quiz, texts) })) }
}

// 一度読み込んだ本文はこの画面にいる間は覚えておく
export function useQuizTexts() {
  const [texts, setTexts] = useState<ReadonlyMap<string, QuizText>>(() => new Map())
  const store = useRef(new Map<string, QuizText>())
  const inflight = useRef(new Map<string, Promise<void>>())

  // ids の本文がそろったら、読み込み済みの本文すべてを返す
  const ensure = useCallback(async (ids: readonly string[]): Promise<ReadonlyMap<string, QuizText>> => {
    const missing = [...new Set(ids)].filter(id => !store.current.has(id) && !inflight.current.has(id))
    if (missing.length > 0) {
      const p = fetchQuizTexts(missing)
        .then(found => {
          // 消された問題も空で覚えておき、何度も問い合わせないようにする
          for (const id of missing) store.current.set(id, found.get(id) ?? EMPTY)
          setTexts(new Map(store.current))
        })
        .finally(() => { for (const id of missing) inflight.current.delete(id) })
      for (const id of missing) inflight.current.set(id, p)
    }
    const waiting = new Set<Promise<void>>()
    for (const id of ids) {
      const p = inflight.current.get(id)
      if (p) waiting.add(p)
    }
    await Promise.all(waiting)
    return store.current
  }, [])

  return { texts, ensure }
}
