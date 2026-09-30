'use client'

import { isImageUrl } from '@/lib/quiz'
import { input, label } from '@/lib/ui'
import { QuizImage } from '@/components/quiz/QuizImage'

export default function ImageUrlField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = value.trim()
  const invalid = v !== '' && !isImageUrl(v)
  return (
    <div className="flex flex-col gap-1">
      <span className={label}>
        画像URL <span className="font-normal text-gray-400">（任意・ビジュアルクイズ用。画像を右クリック→「画像アドレスをコピー」で貼り付け）</span>
      </span>
      <div className="flex items-start gap-3">
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="https://…" className={`${input} flex-1`} />
        {v && !invalid && (
          <QuizImage key={v} src={v} className="h-16 w-24 shrink-0 rounded-lg border border-gray-200 object-cover" />
        )}
      </div>
      {invalid && <span className="text-xs text-red-500">http:// か https:// で始まるURLを入れてください</span>}
    </div>
  )
}
