'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Quiz } from '@/types'
import type { Density } from '@/lib/density'
import { DifficultyBadge } from './Difficulty'

const SIZES: Record<Density, { row: string; text: string; answer: string }> = {
  compact: { row: 'px-3 py-1.5', text: 'text-sm', answer: 'text-sm' },
  normal: { row: 'px-4 py-2.5', text: 'text-[15px]', answer: 'text-[15px]' },
  large: { row: 'px-5 py-4', text: 'text-lg', answer: 'text-lg' },
}

export default function QuizRow({
  quiz,
  density,
  revealAll = false,
  source,
  actions,
  onTagClick,
}: {
  quiz: Quiz
  density: Density
  revealAll?: boolean
  source?: { title: string; href: string } | null
  actions?: ReactNode
  onTagClick?: (tag: string) => void
}) {
  const [open, setOpen] = useState(false)
  const shown = open || revealAll
  const s = SIZES[density]
  const compact = density === 'compact'

  const meta = (
    <>
      <DifficultyBadge level={quiz.difficulty} />
      {quiz.tags.map(t =>
        onTagClick ? (
          <button key={t} type="button" onClick={() => onTagClick(t)} className="text-xs text-indigo-600 hover:underline">
            #{t}
          </button>
        ) : (
          <span key={t} className="text-xs text-indigo-600">#{t}</span>
        ),
      )}
      {source && (
        <Link href={source.href} className="max-w-48 truncate text-xs text-gray-400 hover:text-indigo-600 hover:underline">
          📖 {source.title}
        </Link>
      )}
    </>
  )
  const hasMeta = !!quiz.difficulty || quiz.tags.length > 0 || !!source

  return (
    <div className={`group ${s.row}`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 leading-relaxed">
        <p className={`min-w-0 flex-[1_1_18rem] ${s.text}`}>
          <span className="mr-1.5 font-bold text-indigo-600">Q.</span>
          {quiz.question}
        </p>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`min-w-0 max-w-full text-left ${s.answer}`}
          title={shown ? 'クリックで隠す' : 'クリックで答えを表示'}
        >
          <span className="mr-1.5 font-bold text-emerald-600">A.</span>
          {shown ? (
            <span className="font-semibold text-gray-900">{quiz.answer}</span>
          ) : (
            <span className="inline-block rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 text-xs leading-6 text-gray-400 transition-colors hover:border-emerald-400 hover:text-emerald-600">
              クリックで表示
            </span>
          )}
        </button>
        {compact && hasMeta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
        {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
      </div>

      {shown && quiz.explanation && (
        <p className={`mt-1.5 whitespace-pre-wrap rounded-md bg-amber-50 px-3 py-1.5 leading-relaxed text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="mr-1 font-semibold text-amber-700">解説</span>
          {quiz.explanation}
        </p>
      )}

      {!compact && hasMeta && <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div>}
    </div>
  )
}
