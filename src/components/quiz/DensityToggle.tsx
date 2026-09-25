'use client'

import { setDensity, useDensity, type Density } from '@/lib/density'

const OPTIONS: { value: Density; label: string }[] = [
  { value: 'compact', label: '小' },
  { value: 'normal', label: '中' },
  { value: 'large', label: '大' },
]

export default function DensityToggle() {
  const density = useDensity()
  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span>表示サイズ</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
        {OPTIONS.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => setDensity(o.value)}
            className={`px-2.5 py-1 transition-colors ${
              density === o.value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
