import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS } from '@/lib/quiz'

const STAR_COLORS: Record<number, string> = {
  1: 'text-emerald-500',
  2: 'text-lime-500',
  3: 'text-amber-500',
  4: 'text-orange-500',
  5: 'text-rose-500',
}

export function DifficultyBadge({ level, showLabel = false }: { level: number | null; showLabel?: boolean }) {
  if (!level) return null
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs" title={`難易度: ${DIFFICULTY_LABELS[level]}`}>
      <span className={STAR_COLORS[level]}>
        {'★'.repeat(level)}
        <span className="text-gray-200">{'★'.repeat(5 - level)}</span>
      </span>
      {showLabel && <span className="text-gray-500">{DIFFICULTY_LABELS[level]}</span>}
    </span>
  )
}

export function DifficultyPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-md border px-2 py-1 text-xs transition-colors ${
          value === null ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
        }`}
      >
        未設定
      </button>
      {DIFFICULTY_LEVELS.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          title={DIFFICULTY_LABELS[l]}
          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
            value === l ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'
          }`}
        >
          <span className={STAR_COLORS[l]}>{'★'.repeat(l)}</span>
          <span className="ml-1 hidden sm:inline">{DIFFICULTY_LABELS[l]}</span>
        </button>
      ))}
    </div>
  )
}
