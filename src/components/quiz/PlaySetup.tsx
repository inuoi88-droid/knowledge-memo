'use client'

import type { Quiz } from '@/types'
import { MODES, RULES, TIME_LIMITS, modeAvailability, modePool, ruleAvailable, type PlayConfig, type PlayMode } from '@/lib/play'
import CountPicker from './CountPicker'

export default function PlaySetup({
  pool,
  value,
  onChange,
}: {
  pool: Quiz[]
  value: PlayConfig
  onChange: (c: PlayConfig) => void
}) {
  const available = modePool(value.mode, pool).length

  function pickMode(mode: PlayMode) {
    const rule = ruleAvailable(mode, value.rule) ? value.rule : 'normal'
    onChange({ ...value, mode, rule })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500">あそびかた</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MODES.map(m => {
            const av = modeAvailability(m.id, pool)
            const active = value.mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => av.ok && pickMode(m.id)}
                disabled={!av.ok}
                title={av.reason}
                className={`group relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-100 bg-white hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow'
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-sm ${m.tone}`}>
                  {m.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-gray-900">{m.name}</span>
                  <span className="block truncate text-[11px] text-gray-500">{av.ok ? m.desc : av.reason}</span>
                </span>
                {active && <span className="absolute right-2 top-2 text-xs text-indigo-600">✔</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500">ルール</div>
        <div className="grid grid-cols-3 gap-2">
          {RULES.map(r => {
            const ok = ruleAvailable(value.mode, r.id)
            const active = value.rule === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => ok && onChange({ ...value, rule: r.id })}
                disabled={!ok}
                className={`rounded-xl border-2 px-2 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:border-indigo-200'
                }`}
              >
                <div className="text-sm font-bold">{r.icon} {r.name}</div>
                <div className="text-[11px] text-gray-500">{r.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {value.rule === 'normal' && (
          <>
            <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500">問題数</div>
            <CountPicker max={available} value={Math.min(value.count, Math.max(available, 1))} onChange={count => onChange({ ...value, count })} />
          </>
        )}
        {value.rule === 'timeattack' && (
          <>
            <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500">制限時間</div>
            <div className="flex flex-wrap gap-1.5">
              {TIME_LIMITS.map(s => (
                <button key={s} type="button" onClick={() => onChange({ ...value, timeLimitSec: s })}
                  className={`rounded-lg border px-3 py-1 text-sm transition-colors ${value.timeLimitSec === s ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {s < 60 ? `${s}秒` : `${s / 60}分`}
                </button>
              ))}
            </div>
          </>
        )}
        {value.rule === 'suddendeath' && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {available}問の中からランダムに出題。1問でもまちがえたら終了です。何問連続で正解できるかな？
          </p>
        )}
      </div>
    </div>
  )
}
