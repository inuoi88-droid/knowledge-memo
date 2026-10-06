import { createClient } from './supabase/client'

// この端末（ブラウザ）のプッシュ通知の状態
//   unsupported   … このブラウザは通知に対応していない
//   needs-install … iPhone/iPad：ホーム画面に追加して開く必要がある
//   denied        … 通知がブロックされている
//   off / on      … まだ受け取っていない / 受け取っている
export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function registerWorker() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function fetchReminderInfo(): Promise<{ publicKey: string; emailConfigured: boolean } | null> {
  const { data, error } = await createClient().functions.invoke('reminders', { body: { action: 'vapid' } })
  return error || !data?.publicKey ? null : data
}

// 押されたボタンの中から呼ぶこと（iPhone は操作の直後でないと許可を求められない）
export async function enablePush(): Promise<string | null> {
  if (!supported()) return 'このブラウザは通知に対応していません。'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return '通知が許可されませんでした。端末の設定で、知識メモの通知を許可してください。'
  const reg = await registerWorker()
  await navigator.serviceWorker.ready
  const info = await fetchReminderInfo()
  if (!info) return '通知の準備に失敗しました。時間をおいてもう一度お試しください。'
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(info.publicKey) }))
  const j = sub.toJSON()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'ログインが必要です。'
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'user_id,endpoint' },
  )
  return error ? `端末を登録できませんでした: ${error.message}` : null
}

export async function disablePushHere(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await createClient().from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestReminder(channel: 'push' | 'email'): Promise<string> {
  const { data, error } = await createClient().functions.invoke('reminders', { body: { action: 'test', channel } })
  if (error) return '送れませんでした。時間をおいてもう一度お試しください。'
  if (channel === 'email') {
    if (data?.ok) return 'テストメールを送りました。届くまで少しかかることがあります。'
    return data?.error === 'not_configured' ? 'メール送信の準備がまだできていません。' : `メールを送れませんでした（${String(data?.error ?? '').slice(0, 80)}）`
  }
  if (!data?.devices) return '通知を受け取る端末がまだ登録されていません。'
  return data.sent > 0 ? `${data.sent}台の端末にテスト通知を送りました。` : '端末に届きませんでした。もう一度「この端末で受け取る」を押してください。'
}
