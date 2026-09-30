'use client'

import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS, type TagCount } from '@/lib/quiz'
import { btn, chip, input } from '@/lib/ui'
import TagPicker from '@/components/TagPicker'

export type StudyStatus = 'new' | 'weak' | 'due'

export const STUDY_STATUS_LABELS: Record<StudyStatus, string> = {
  new: '🆕 未学習',
  weak: '😣 苦手',
  due: '🔁 復習の時期',
}

export default function QuizFilters({
  tagCounts, genres, matchAll, levels, onToggleGenre, onToggleMatchAll, onToggleLevel,
  keyword = null, onKeyword, statuses, onToggleStatus, onClear,
}: {
  tagCounts: TagCount[]
  genres: string[]
  matchAll: boolean
  levels: number[]
  onToggleGenre: (g: string) => void
  onToggleMatchAll: () => void
  onToggleLevel: (l: number) => void
  keyword?: string | null
  onKeyword?: (v: string) => void
  statuses?: StudyStatus[]
  onToggleStatus?: (s: StudyStatus) => void
  onClear: () => void
}) {
  const hasFilter = genres.length > 0 || levels.length > 0 || !!keyword?.trim() || (statuses?.length ?? 0) > 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="w-14 shrink-0 pt-1 text-xs font-medium text-gray-500">ジャンル</span>
        <div className="min-w-0 flex-1">
          <TagPicker tags={tagCounts} selected={genres} onToggle={onToggleGenre} />
        </div>
        {genres.length > 1 && (
          <button onClick={onToggleMatchAll} className="text-xs text-indigo-600 hover:underline">
            {matchAll ? 'すべて含む' : 'どれかを含む'} ⇄
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <span className="w-14 shrink-0 pt-0.5 text-xs font-medium text-gray-500">難易度</span>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {DIFFICULTY_LEVELS.map(l => (
            <button key={l} onClick={() => onToggleLevel(l)} className={chip(levels.includes(l))} title={DIFFICULTY_LABELS[l]}>
              {'★'.repeat(l)} <span className="hidden sm:inline">{DIFFICULTY_LABELS[l]}</span>
            </button>
          ))}
          <button onClick={() => onToggleLevel(0)} className={chip(levels.includes(0))}>未設定</button>
        </div>
      </div>
      {statuses && onToggleStatus && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="w-14 shrink-0 pt-0.5 text-xs font-medium text-gray-500">学習状況</span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {(Object.keys(STUDY_STATUS_LABELS) as StudyStatus[]).map(s => (
              <button key={s} onClick={() => onToggleStatus(s)} className={chip(statuses.includes(s))}>{STUDY_STATUS_LABELS[s]}</button>
            ))}
          </div>
        </div>
      )}
      {(keyword !== null || hasFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          {keyword !== null && onKeyword && (
            <>
              <span className="w-14 shrink-0 text-xs font-medium text-gray-500">検索</span>
              <input value={keyword} onChange={e => onKeyword(e.target.value)}
                placeholder="問題・答え・解説から探す" className={`${input} max-w-sm flex-1 py-1.5`} />
            </>
          )}
          {hasFilter && <button onClick={onClear} className={btn.ghost}>条件をクリア</button>}
        </div>
      )}
    </div>
  )
}
