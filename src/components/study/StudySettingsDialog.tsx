'use client'

import { useState } from 'react'
import { MAX_REVIEW_STEPS, REVIEW_PRESETS, formatDays, saveStudySettings, type StudySettings } from '@/lib/progress'
import { btn } from '@/lib/ui'

export default function StudySettingsDialog({
  value,
  onClose,
  onSaved,
}: {
  value: StudySettings
  onClose: () => void
  onSaved: () => void
}) {
  const [repeats, setRepeats] = useState(value.checkRepeats)
  const [days, setDays] = useState<string[]>(value.reviewDays.map(String))
  const [style, setStyle] = useState(value.reviewStyle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = days.map(d => Number.parseInt(d, 10))
  const valid = parsed.every(d => Number.isInteger(d) && d >= 1 && d <= 3650) && parsed.length >= 2 && parsed.length <= MAX_REVIEW_STEPS
  const presetMatch = REVIEW_PRESETS.find(p => p.days.join(',') === parsed.join(','))

  function setDay(i: number, v: string) {
    setDays(ds => ds.map((d, j) => (j === i ? v.replace(/[^\d]/g, '') : d)))
  }

  async function save() {
    if (!valid) { setError('間隔は1〜3650日の整数で入れてください。'); return }
    setBusy(true)
    setError(null)
    const err = await saveStudySettings({ reviewDays: parsed, checkRepeats: repeats, reviewStyle: style })
    setBusy(false)
    if (err) { setError(`保存できませんでした: ${err}`); return }
    onSaved()
  }

  const opt = (active: boolean) =>
    `rounded-xl border-2 px-3 py-2 text-sm transition-colors ${active ? 'border-indigo-500 bg-indigo-50 font-bold text-indigo-700' : 'border-gray-100 text-gray-600 hover:border-indigo-200'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black">⚙️ 学習の設定</h2>
        <p className="mt-1 text-xs text-gray-500">覚えるペースは人それぞれ。自分に合った回数と間隔にできます。</p>

        <section className="mt-5">
          <h3 className="text-sm font-black text-gray-900">✍️ 確かめる：合格までに正しく書く回数</h3>
          <p className="mb-2 text-xs text-gray-500">同じ問題を、間に他の問題をはさみながら何回書かせるか。まちがえたら回数は最初からです。</p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRepeats(n)} className={opt(repeats === n)}>{n}回</button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-black text-gray-900">🔁 復習の間隔：正解してから次に出すまで</h3>
          <p className="mb-2 text-xs text-gray-500">復習で正解するたびに次の段階へ進みます。まちがえると最初の段階に戻り、10分後にもう一度出ます。</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {REVIEW_PRESETS.map(p => (
              <button key={p.name} type="button" onClick={() => setDays(p.days.map(String))} className={`${opt(presetMatch === p)} text-left`}>
                <div>{p.name}</div>
                <div className="text-[11px] font-normal text-gray-500">{p.desc}</div>
              </button>
            ))}
          </div>
          <ol className="flex flex-col gap-1.5">
            {days.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-gray-500">{i + 1}回目の正解後</span>
                <input
                  value={d}
                  onChange={e => setDay(i, e.target.value)}
                  inputMode="numeric"
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right outline-none focus:border-indigo-500"
                />
                <span className="text-gray-600">日後</span>
                {Number.parseInt(d, 10) >= 7 && <span className="text-xs text-gray-400">（{formatDays(Number.parseInt(d, 10))}）</span>}
                {days.length > 2 && (
                  <button type="button" onClick={() => setDays(ds => ds.filter((_, j) => j !== i))} className="ml-auto text-xs text-red-400 hover:text-red-600">削除</button>
                )}
              </li>
            ))}
          </ol>
          {days.length < MAX_REVIEW_STEPS && (
            <button
              type="button"
              onClick={() => setDays(ds => [...ds, String(Math.min(3650, (Number.parseInt(ds.at(-1) ?? '1', 10) || 1) * 2))])}
              className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
            >
              ＋ 段階を追加
            </button>
          )}
          {valid && (
            <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-900">
              {parsed.map(formatDays).join(' → ')} の間隔で出題。<br />
              {Math.max(1, parsed.length - 1)}回目の復習に正解すると「覚えた」になります（その後も {formatDays(parsed.at(-1)!)} ごとに確認）。
            </p>
          )}
          <p className="mt-1 text-[11px] text-gray-400">変更はこれから答える問題に反映されます（すでに決まっている復習日はそのまま）。</p>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-black text-gray-900">🔁 復習の答え方</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setStyle('typing')} className={`${opt(style === 'typing')} text-left`}>
              <div>✍️ 書いて答える</div>
              <div className="text-[11px] font-normal text-gray-500">おすすめ。自動で採点</div>
            </button>
            <button type="button" onClick={() => setStyle('cards')} className={`${opt(style === 'cards')} text-left`}>
              <div>📖 めくって自己採点</div>
              <div className="text-[11px] font-normal text-gray-500">答えが長い問題が多いとき</div>
            </button>
          </div>
        </section>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className={btn.secondary}>キャンセル</button>
          <button onClick={save} disabled={busy || !valid} className={btn.primary}>{busy ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}
