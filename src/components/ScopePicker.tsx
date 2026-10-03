'use client'

import { useState } from 'react'
import type { ShelfNode, SourceType } from '@/types'
import { ALL_SCOPE, isAllScope, scopeLabel, toggleItem, toggleShelf, type Scope } from '@/lib/scope'

const SOURCE_ICONS: Record<SourceType, string> = { book: '📕', youtube: '▶️', web: '🌐', other: '📎' }

// クイズのある本棚・アイテムだけを残す
export function quizTree(tree: readonly ShelfNode[], counts: ReadonlyMap<string, number>): ShelfNode[] {
  return tree
    .map(s => ({ ...s, items: s.items.filter(i => (counts.get(i.id) ?? 0) > 0) }))
    .filter(s => s.items.length > 0)
}

export function countByItem(quizzes: readonly { item_id: string }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const q of quizzes) m.set(q.item_id, (m.get(q.item_id) ?? 0) + 1)
  return m
}

function Check({ state }: { state: 'on' | 'off' | 'some' }) {
  return (
    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black leading-none ${
      state === 'off' ? 'border-gray-300 bg-white' : 'border-indigo-600 bg-indigo-600 text-white'
    }`}>
      {state === 'on' ? '✓' : state === 'some' ? '−' : ''}
    </span>
  )
}

export default function ScopePicker({
  tree,
  counts,
  value,
  onChange,
  total,
}: {
  tree: ShelfNode[]
  counts: ReadonlyMap<string, number>
  value: Scope
  onChange: (s: Scope) => void
  total: number
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree.filter(s => s.items.some(i => value.itemIds.includes(i.id))).map(s => s.id)),
  )
  const all = isAllScope(value)
  const shelfCount = (s: ShelfNode) => s.items.reduce((n, i) => n + (counts.get(i.id) ?? 0), 0)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${open ? 'border-indigo-400 bg-indigo-50/60' : 'border-gray-100 bg-white hover:border-indigo-200'}`}
      >
        <span className="text-2xl">📚</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-gray-500">範囲</span>
          <span className="block truncate font-black text-gray-900">{scopeLabel(value, tree)}</span>
        </span>
        <span className="shrink-0 text-sm text-gray-500"><b className="text-lg font-black text-indigo-600">{total}</b> 問</span>
        <span className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">{open ? '閉じる' : '変える'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => onChange(ALL_SCOPE)}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm ${all ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <Check state={all ? 'on' : 'off'} />
            すべての本棚
          </button>
          {tree.map(s => {
            const shelfOn = value.shelfIds.includes(s.id)
            const picked = s.items.filter(i => value.itemIds.includes(i.id)).length
            const isOpen = expanded.has(s.id)
            return (
              <div key={s.id} className="rounded-xl border border-gray-100">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onChange(toggleShelf(value, s, tree))}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-l-xl px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <Check state={shelfOn ? 'on' : picked > 0 ? 'some' : 'off'} />
                    <span className="min-w-0 flex-1 truncate font-bold text-gray-900">📚 {s.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">{shelfCount(s)}問</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(s.id)}
                    className="shrink-0 rounded-r-xl px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? '▾' : '▸'} アイテム{s.items.length}
                  </button>
                </div>
                {isOpen && (
                  <ul className="border-t border-gray-100 py-1">
                    {s.items.map(i => {
                      const on = shelfOn || value.itemIds.includes(i.id)
                      return (
                        <li key={i.id}>
                          <button
                            type="button"
                            onClick={() => onChange(toggleItem(value, s, i.id, tree))}
                            className="flex w-full items-center gap-2.5 py-1.5 pl-8 pr-3 text-left text-sm hover:bg-gray-50"
                          >
                            <Check state={on ? 'on' : 'off'} />
                            <span className="min-w-0 flex-1 truncate text-gray-700">{SOURCE_ICONS[i.source_type]} {i.title}</span>
                            <span className="shrink-0 text-xs text-gray-400">{counts.get(i.id) ?? 0}問</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
