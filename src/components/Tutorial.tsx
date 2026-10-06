'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SAMPLE_COUNT, createSample } from '@/lib/sample'

function Mock({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left text-xs text-gray-700">{children}</div>
}

const STEPS: { icon: string; title: string; body: string; visual: React.ReactNode }[] = [
  {
    icon: '👋',
    title: '知識メモへようこそ！',
    body: '本・YouTube・Webで知ったことをクイズにして、毎日少しずつ覚えていくアプリです。使い方を1分で紹介します。',
    visual: (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1 text-xs font-bold sm:text-sm">
        {['📚 整理する', '✍️ クイズにする', '📖 毎日学習'].map((t, i) => (
          <span key={t} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">→</span>}
            <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{t}</span>
          </span>
        ))}
      </div>
    ),
  },
  {
    icon: '📚',
    title: '① 本棚とアイテムで整理する',
    body: '「本棚」はジャンルの棚（例：英単語・日本史）。その中に、本・YouTube・Webページなどの「アイテム」を入れていきます。',
    visual: (
      <Mock>
        <div className="font-bold text-gray-900">📚 日本史</div>
        <div className="mt-1.5 flex flex-col gap-1 pl-3">
          <span>📕 まんが日本の歴史 1巻</span>
          <span>▶️ 鎌倉時代をわかりやすく解説</span>
          <span>🌐 歴史年表まとめ</span>
        </div>
      </Mock>
    ),
  },
  {
    icon: '✍️',
    title: '② アイテムにクイズを入れる',
    body: 'アイテムを開いて「問題」と「答え」を追加します。スプレッドシートからまとめて貼り付けることもできます。',
    visual: (
      <Mock>
        <div><b className="text-indigo-600">Q.</b> 鎌倉幕府を開いたのは？</div>
        <div className="mt-1"><b className="text-emerald-600">A.</b> 源頼朝</div>
        <div className="mt-2 text-[11px] text-gray-400">📋 スプレッドシートからまとめて追加 もできます</div>
      </Mock>
    ),
  },
  {
    icon: '📖',
    title: '③ 毎日「今日の学習」を1回',
    body: '「学習」タブの「▶ 今日の学習をはじめる」を押すだけ。その日にやることを自動で出します。',
    visual: (
      <Mock>
        <ol className="flex flex-col gap-1.5">
          <li><b>1. 🔁 復習</b> … 前に覚えた問題を思い出す</li>
          <li><b>2. 📖 覚える</b> … 新しい問題の答えを、まず全部見る</li>
          <li><b>3. ✍️ 書いて確かめる</b> … 答えを何回か書いて身につける</li>
        </ol>
        <div className="mt-2 text-[11px] text-gray-500">覚えた問題は、1日後・3日後・1週間後…と忘れかけた頃にまた出てきます。</div>
      </Mock>
    ),
  },
  {
    icon: '🔔',
    title: '④ 通知をオンにして続ける',
    body: '毎日決まった時刻に「今日の学習」をお知らせできます（スマホの通知・メール）。iPhoneはSafariの共有ボタンから「ホーム画面に追加」すると通知が届きます。',
    visual: (
      <Mock>
        <div className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
          <span className="text-2xl">📖</span>
          <span>
            <b className="block text-gray-900">今日の学習の時間です</b>
            <span className="text-gray-500">復習 5問・新しい問題 10問が待っています</span>
          </span>
        </div>
        <div className="mt-2 text-[11px] text-gray-500">🎮 クイズで遊んだり、🌏 本棚を公開してみんなで早押しすることもできます。</div>
      </Mock>
    ),
  },
]

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = step === STEPS.length
  const s = STEPS[step]

  // 一度見たら次からは自動で出さない（右上の「使い方」からいつでも見られる）
  async function finish(next?: string) {
    void createClient().auth.updateUser({ data: { tutorial_done: true } })
    onClose()
    if (next) router.push(next)
  }

  async function trySample() {
    setBusy(true)
    setError(null)
    const res = await createSample()
    setBusy(false)
    if ('error' in res) { setError(`サンプルを作れませんでした: ${res.error}`); return }
    await finish(`/dashboard/study?item=${res.itemId}`)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="h-1.5 bg-gray-100">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
        <div className="p-6 text-center sm:p-7">
          {!last ? (
            <div key={step} className="animate-slide-up">
              <div className="text-5xl">{s.icon}</div>
              <h2 className="mt-3 text-xl font-black text-gray-900">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.body}</p>
              {s.visual}
            </div>
          ) : (
            <div className="animate-slide-up">
              <div className="text-5xl">🚀</div>
              <h2 className="mt-3 text-xl font-black text-gray-900">さっそく始めよう</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">まずはサンプルの問題で「今日の学習」を体験するのがおすすめです。</p>
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={trySample} disabled={busy}
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 font-black text-white shadow-lg disabled:opacity-50">
                  {busy ? '準備しています…' : `📦 サンプル（県庁所在地 ${SAMPLE_COUNT}問）で試す`}
                </button>
                <button onClick={() => finish('/dashboard')} disabled={busy} className="rounded-2xl border-2 border-indigo-100 py-3 font-bold text-indigo-700 hover:bg-indigo-50">
                  📚 自分の本棚を作る
                </button>
                <button onClick={() => finish('/dashboard/study?notify=1')} disabled={busy} className="rounded-2xl border-2 border-gray-100 py-3 font-bold text-gray-700 hover:bg-gray-50">
                  🔔 毎日の通知を設定する
                </button>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">サンプルの本棚は、いらなくなったら本棚の画面から削除できます。</p>
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            <button onClick={() => (step === 0 ? finish() : setStep(step - 1))} className="rounded-xl px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100">
              {step === 0 ? 'スキップ' : '← 戻る'}
            </button>
            <div className="flex gap-1.5">
              {Array.from({ length: STEPS.length + 1 }, (_, i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i === step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              ))}
            </div>
            {!last ? (
              <button onClick={() => setStep(step + 1)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700">
                次へ →
              </button>
            ) : (
              <button onClick={() => finish()} className="rounded-xl px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100">閉じる</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
