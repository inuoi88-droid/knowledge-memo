'use client'

import { useEffect, useState } from 'react'
import { REMIND_TIMES, formatMinute, saveReminderSettings, type ReminderSettings } from '@/lib/reminders'
import { disablePushHere, enablePush, fetchReminderInfo, getPushState, isIOS, sendTestReminder, type PushState } from '@/lib/push'
import { btn } from '@/lib/ui'

export default function ReminderDialog({
  value,
  deviceCount,
  email,
  onClose,
  onSaved,
}: {
  value: ReminderSettings
  deviceCount: number
  email: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pushEnabled, setPushEnabled] = useState(value.pushEnabled)
  const [emailEnabled, setEmailEnabled] = useState(value.emailEnabled)
  const [minute, setMinute] = useState(value.remindMinute)
  const [pushState, setPushState] = useState<PushState | null>(null)
  const [devices, setDevices] = useState(deviceCount)
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    getPushState().then(s => { if (!cancelled) setPushState(s) }).catch(() => { if (!cancelled) setPushState('unsupported') })
    fetchReminderInfo().then(info => { if (!cancelled) setEmailConfigured(info?.emailConfigured ?? false) })
    return () => { cancelled = true }
  }, [])

  async function turnOnHere() {
    setBusy('device')
    setNote(null)
    const err = await enablePush()
    setBusy(null)
    if (err) { setNote({ kind: 'error', msg: err }); setPushState(await getPushState()); return }
    setPushState('on')
    setPushEnabled(true)
    setDevices(n => n + 1)
    setNote({ kind: 'ok', msg: 'この端末で通知を受け取れるようになりました。「保存」を押してください。' })
  }

  async function turnOffHere() {
    setBusy('device')
    await disablePushHere()
    setBusy(null)
    setPushState('off')
    setDevices(n => Math.max(0, n - 1))
  }

  async function test(channel: 'push' | 'email') {
    setBusy(channel)
    setNote(null)
    const msg = await sendTestReminder(channel)
    setBusy(null)
    setNote({ kind: msg.includes('送りました') ? 'ok' : 'error', msg })
  }

  async function save() {
    setBusy('save')
    const err = await saveReminderSettings({ ...value, pushEnabled, emailEnabled, remindMinute: minute })
    setBusy(null)
    if (err) { setNote({ kind: 'error', msg: `保存できませんでした: ${err}` }); return }
    onSaved()
  }

  const opt = (active: boolean) =>
    `flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors ${active ? 'border-indigo-500 bg-indigo-50/60' : 'border-gray-100 hover:border-indigo-200'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black">🔔 毎日の通知</h2>
        <p className="mt-1 text-xs text-gray-500">「今日の学習」を忘れないよう、毎日決まった時刻にお知らせします。その日の分が終わっていれば届きません。</p>

        <section className="mt-5">
          <h3 className="text-sm font-black text-gray-900">⏰ 通知する時刻</h3>
          <div className="mt-2 flex items-center gap-2">
            <select value={minute} onChange={e => setMinute(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-lg font-bold outline-none focus:border-indigo-500">
              {REMIND_TIMES.map(m => <option key={m} value={m}>{formatMinute(m)}</option>)}
            </select>
            <span className="text-xs text-gray-500">毎日（日本時間）</span>
          </div>
        </section>

        <section className="mt-6 flex flex-col gap-3">
          <h3 className="text-sm font-black text-gray-900">📮 受け取り方（両方でもOK）</h3>

          <div className={opt(pushEnabled)}>
            <input type="checkbox" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" aria-label="プッシュ通知" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-gray-900">📱 プッシュ通知</div>
              <div className="text-xs text-gray-500">スマホやパソコンに通知が届きます。登録している端末：{devices}台</div>
              <div className="mt-2 rounded-lg bg-white p-2.5 text-xs leading-relaxed text-gray-600 ring-1 ring-gray-100">
                {pushState === null && 'この端末を確認しています…'}
                {pushState === 'needs-install' && (
                  <>
                    <b className="text-gray-900">iPhoneでは、ホーム画面に追加すると通知を受け取れます。</b>
                    <ol className="mt-1 list-decimal pl-4">
                      <li>Safariで知識メモを開き、下の共有ボタン（□に↑）を押す</li>
                      <li>「ホーム画面に追加」を押す</li>
                      <li>ホーム画面の「知識メモ」から開いて、もう一度ここで「この端末で受け取る」を押す</li>
                    </ol>
                  </>
                )}
                {pushState === 'unsupported' && 'このブラウザは通知に対応していません。別のブラウザ（Chrome・Edge・Safari など）でお試しください。'}
                {pushState === 'denied' && (isIOS()
                  ? '通知がオフになっています。iPhoneの「設定」→「通知」→「知識メモ」で通知を許可してください。'
                  : '通知がブロックされています。ブラウザのアドレスバーの鍵マークなどから、このサイトの通知を許可してください。')}
                {pushState === 'off' && (
                  <button onClick={turnOnHere} disabled={busy !== null} className={btn.primary}>
                    {busy === 'device' ? '登録中…' : 'この端末で受け取る'}
                  </button>
                )}
                {pushState === 'on' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-emerald-700">✓ この端末で受け取ります</span>
                    <button onClick={() => test('push')} disabled={busy !== null} className={btn.secondary}>{busy === 'push' ? '送信中…' : 'テスト通知を送る'}</button>
                    <button onClick={turnOffHere} disabled={busy !== null} className={btn.ghost}>この端末をやめる</button>
                  </div>
                )}
              </div>
              {pushEnabled && devices === 0 && pushState !== 'on' && (
                <p className="mt-1 text-[11px] text-amber-700">まだ端末が登録されていません。受け取りたい端末で「この端末で受け取る」を押してください。</p>
              )}
            </div>
          </div>

          <div className={opt(emailEnabled)}>
            <input type="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" aria-label="メール" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-gray-900">✉️ メール</div>
              <div className="truncate text-xs text-gray-500">{email ?? 'メールアドレスがありません'} に届きます</div>
              {emailConfigured === false && (
                <p className="mt-1 text-[11px] text-amber-700">メールを送る準備がまだできていません（管理者がメール送信サービスを設定すると届くようになります）。</p>
              )}
              {emailConfigured && email && (
                <button onClick={() => test('email')} disabled={busy !== null} className={`${btn.secondary} mt-2`}>{busy === 'email' ? '送信中…' : 'テストメールを送る'}</button>
              )}
            </div>
          </div>
        </section>

        {note && <p className={`mt-4 text-sm ${note.kind === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{note.msg}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className={btn.secondary}>キャンセル</button>
          <button onClick={save} disabled={busy !== null} className={btn.primary}>{busy === 'save' ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}
