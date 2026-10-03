import { cache } from 'react'
import type { Quiz, QuizSource } from '@/types'
import { createClient } from './server'
import { fetchSourceQuizzes } from './queries'

export interface SourcePageData {
  source: QuizSource
  title: string
  subtitle: string | null
  ownerId: string
  isPublic: boolean
  authorName: string | null
  // アイテムが本棚ごと公開されているとき
  publicShelf: { id: string; name: string } | null
  // 本棚のとき、中のアイテム（クイズのあるもの）
  items: { id: string; title: string; count: number }[]
  quizzes: (Quiz & { item_id: string })[]
  manageHref: string
}

// 自分のもの、または公開されているものだけ読める（RLS）
export const loadSourcePage = cache(async (kind: QuizSource['kind'], id: string): Promise<SourcePageData | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const source: QuizSource = { kind, id }

  if (kind === 'item') {
    const [{ data: item }, quizzes] = await Promise.all([
      supabase
        .from('items')
        .select('id, title, author, is_public, author_name, user_id, shelf_id, shelves(id, name, is_public, author_name)')
        .eq('id', id)
        .maybeSingle(),
      fetchSourceQuizzes(supabase, source),
    ])
    if (!item) return null
    const shelf = item.shelves as unknown as { id: string; name: string; is_public: boolean; author_name: string | null } | null
    const viaShelf = !item.is_public && !!shelf?.is_public
    return {
      source,
      title: item.title,
      subtitle: item.author,
      ownerId: item.user_id,
      isPublic: item.is_public || viaShelf,
      authorName: (viaShelf ? shelf?.author_name : item.author_name) ?? null,
      publicShelf: viaShelf && shelf ? { id: shelf.id, name: shelf.name } : null,
      items: [],
      quizzes,
      manageHref: `/dashboard/${item.shelf_id}/${item.id}`,
    }
  }

  const [{ data: shelf }, quizzes] = await Promise.all([
    supabase
      .from('shelves')
      .select('id, name, is_public, author_name, user_id, items(id, title, created_at)')
      .eq('id', id)
      .order('created_at', { referencedTable: 'items', ascending: false })
      .maybeSingle(),
    fetchSourceQuizzes(supabase, source),
  ])
  if (!shelf) return null
  const counts = new Map<string, number>()
  for (const q of quizzes) counts.set(q.item_id, (counts.get(q.item_id) ?? 0) + 1)
  return {
    source,
    title: shelf.name,
    subtitle: null,
    ownerId: shelf.user_id,
    isPublic: shelf.is_public,
    authorName: shelf.author_name ?? null,
    publicShelf: null,
    items: ((shelf.items ?? []) as { id: string; title: string }[])
      .map(i => ({ id: i.id, title: i.title, count: counts.get(i.id) ?? 0 }))
      .filter(i => i.count > 0),
    quizzes,
    manageHref: `/dashboard/${shelf.id}`,
  }
})
