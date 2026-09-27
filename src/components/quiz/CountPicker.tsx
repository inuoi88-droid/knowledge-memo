'use client'

import { useState } from 'react'

export default function CountPicker({
  max,
  value,
  onChange,
  presets = [5, 10, 20, 50, 100],
}: {
  max: number
  value: number
  onChange: (n: number) => void
  presets?: number[]
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(max, Math.max(1, n))
  const opt = (active: boolean) =>
    `rounded-lg border px-2.5 py-1 text-xs transition-colors ${active ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`

  if (max <= 0) return <span className="text-xs text-gray-400">問題がありません</span>

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.filter(p => p < max).map(p => (
          <button key={p} type="button" onClick={() => { setDraft(null); onChange(p) }} className={opt(value === p)}>{p}問</button>
        ))}
        <button type="button" onClick={() => { setDraft(null); onChange(max) }} className={opt(value === max)}>全部（{max}問）</button>
        <label className="ml-1 inline-flex items-center gap-1 text-xs text-gray-500">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={draft ?? String(value)}
            onChange={e => {
              setDraft(e.target.value)
              const n = Number.parseInt(e.target.value, 10)
              if (!Number.isNaN(n)) onChange(clamp(n))
            }}
            onBlur={() => setDraft(null)}
            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:border-indigo-500"
          />
          問
        </label>
      </div>
      {max > 10 && (
        <input
          type="range"
          min={1}
          max={max}
          value={value}
          onChange={e => { setDraft(null); onChange(clamp(Number(e.target.value))) }}
          className="w-full accent-indigo-600"
          aria-label="問題数"
        />
      )}
    </div>
  )
}
