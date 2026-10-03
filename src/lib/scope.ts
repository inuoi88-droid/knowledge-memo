import type { QuizSource, ShelfNode } from '@/types'

// 学習・クイズの範囲。本棚を丸ごと選ぶか、アイテムを1つずつ選ぶ。どちらも空なら全部
export interface Scope {
  shelfIds: string[]
  itemIds: string[]
}

export const ALL_SCOPE: Scope = { shelfIds: [], itemIds: [] }

export function isAllScope(s: Scope): boolean {
  return s.shelfIds.length === 0 && s.itemIds.length === 0
}

export function inScope(q: { shelf_id: string | null; item_id: string }, s: Scope): boolean {
  if (isAllScope(s)) return true
  return (!!q.shelf_id && s.shelfIds.includes(q.shelf_id)) || s.itemIds.includes(q.item_id)
}

// 消された本棚・アイテムを外し、アイテムが全部選ばれていれば本棚にまとめる
export function normalizeScope(s: Scope, tree: readonly ShelfNode[]): Scope {
  const shelfIds = s.shelfIds.filter(id => tree.some(sh => sh.id === id))
  let itemIds = s.itemIds.filter(id => tree.some(sh => !shelfIds.includes(sh.id) && sh.items.some(i => i.id === id)))
  for (const sh of tree) {
    if (shelfIds.includes(sh.id) || sh.items.length === 0) continue
    if (sh.items.every(i => itemIds.includes(i.id))) {
      shelfIds.push(sh.id)
      itemIds = itemIds.filter(id => !sh.items.some(i => i.id === id))
    }
  }
  return { shelfIds, itemIds }
}

export function toggleShelf(s: Scope, shelf: ShelfNode, tree: readonly ShelfNode[]): Scope {
  const itemIds = s.itemIds.filter(id => !shelf.items.some(i => i.id === id))
  const shelfIds = s.shelfIds.includes(shelf.id) ? s.shelfIds.filter(id => id !== shelf.id) : [...s.shelfIds, shelf.id]
  return normalizeScope({ shelfIds, itemIds }, tree)
}

export function toggleItem(s: Scope, shelf: ShelfNode, itemId: string, tree: readonly ShelfNode[]): Scope {
  if (s.shelfIds.includes(shelf.id)) {
    // 本棚ごと選んでいたら、このアイテムだけ外す
    return normalizeScope({
      shelfIds: s.shelfIds.filter(id => id !== shelf.id),
      itemIds: [...s.itemIds, ...shelf.items.map(i => i.id).filter(id => id !== itemId)],
    }, tree)
  }
  const itemIds = s.itemIds.includes(itemId) ? s.itemIds.filter(id => id !== itemId) : [...s.itemIds, itemId]
  return normalizeScope({ shelfIds: s.shelfIds, itemIds }, tree)
}

export function scopeLabel(s: Scope, tree: readonly ShelfNode[]): string {
  if (isAllScope(s)) return 'すべての本棚'
  const names = [
    ...tree.filter(sh => s.shelfIds.includes(sh.id)).map(sh => sh.name),
    ...tree.flatMap(sh => sh.items).filter(i => s.itemIds.includes(i.id)).map(i => i.title),
  ]
  if (names.length === 0) return 'すべての本棚'
  return names.length <= 2 ? names.join('・') : `${names.slice(0, 2).join('・')} ほか${names.length - 2}件`
}

export function scopeFromParams(p: { shelf?: string; item?: string }): Scope | null {
  const uuid = /^[0-9a-f-]{36}$/i
  if (p.item && uuid.test(p.item)) return { shelfIds: [], itemIds: [p.item] }
  if (p.shelf && uuid.test(p.shelf)) return { shelfIds: [p.shelf], itemIds: [] }
  return null
}

export function sourceHref(s: QuizSource): string {
  return `/quiz/${s.kind}/${s.id}`
}
