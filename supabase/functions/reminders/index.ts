// 毎日の学習通知（プッシュ通知・メール）を送る Edge Function
//   { action: 'vapid' }            … ブラウザの登録に使う公開鍵（はじめて呼ばれたときに鍵を作って保存する）
//   { action: 'test', channel }    … ログイン中の本人にテスト通知を送る（channel: 'push' | 'email'）
//   { action: 'cron' }             … pg_cron から15分ごとに呼ばれ、時刻が来た人に送る（1人1日1回まで）
// メールは Edge Function のシークレット RESEND_API_KEY（と任意で REMINDER_EMAIL_FROM）があるときだけ送る。
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('REMINDER_EMAIL_FROM') ?? '知識メモ <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://knowledge-memo-9i2z.vercel.app'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

interface Payload { title: string; body: string; url: string }

let serverPromise: Promise<{ appServer: webpush.ApplicationServer; publicKey: string }> | null = null

function getServer() {
  serverPromise ??= (async () => {
    const read = () => admin.from('app_secrets').select('value').eq('key', 'vapid').maybeSingle()
    let { data } = await read()
    if (!data) {
      const keys = await webpush.generateVapidKeys({ extractable: true })
      const jwks = await webpush.exportVapidKeys(keys)
      // 同時に呼ばれても鍵は1つだけ
      await admin.from('app_secrets').upsert({ key: 'vapid', value: jwks }, { onConflict: 'key', ignoreDuplicates: true })
      ;({ data } = await read())
    }
    const vapidKeys = await webpush.importVapidKeys(data!.value, { extractable: false })
    const publicKey = await webpush.exportApplicationServerKey(vapidKeys)
    const appServer = await webpush.ApplicationServer.new({ contactInformation: SITE_URL, vapidKeys })
    return { appServer, publicKey }
  })().catch(e => {
    serverPromise = null
    throw e
  })
  return serverPromise
}

async function pushTo(userId: string, payload: Payload) {
  const { appServer } = await getServer()
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await appServer
        .subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
        .pushTextMessage(JSON.stringify(payload), { ttl: 12 * 60 * 60 })
      sent++
    } catch (e) {
      const status = (e as { response?: Response }).response?.status
      // 期限切れ・解除された端末は消す
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push failed', status, String(e))
    }
  }
  return { sent, devices: subs?.length ?? 0 }
}

async function emailTo(to: string, payload: Payload) {
  if (!RESEND_API_KEY) return { ok: false, error: 'not_configured' }
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="margin:0 0 8px">${payload.title}</h2>
      <p style="color:#444;line-height:1.6">${payload.body}</p>
      <p><a href="${payload.url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">知識メモを開く</a></p>
      <p style="color:#999;font-size:12px">通知の時刻や方法は、知識メモの「学習」タブ →「🔔 通知」で変えられます。</p>
    </div>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject: payload.title, html, text: `${payload.body}\n${payload.url}` }),
  })
  return res.ok ? { ok: true } : { ok: false, error: await res.text() }
}

function reminderPayload(due: number, fresh: number): Payload {
  const parts = [due > 0 && `復習 ${due}問`, fresh > 0 && `新しい問題 ${fresh}問`].filter(Boolean)
  return {
    title: '📖 今日の学習の時間です',
    body: `${parts.join('・')}が待っています。1日1回、続けて覚えよう！`,
    url: `${SITE_URL}/dashboard/study`,
  }
}

async function runCron() {
  const { data: rows, error } = await admin.rpc('claim_due_reminders')
  if (error) throw error
  let pushed = 0
  let emailed = 0
  for (const r of rows ?? []) {
    const due = Number(r.due_count)
    const fresh = Number(r.new_left)
    // 今日の分が終わっている人には送らない
    if (due + fresh === 0) continue
    const payload = reminderPayload(due, fresh)
    if (r.push_enabled) pushed += (await pushTo(r.user_id, payload)).sent
    if (r.email_enabled && r.email && (await emailTo(r.email, payload)).ok) emailed++
  }
  return { users: rows?.length ?? 0, pushed, emailed }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { action, channel } = await req.json().catch(() => ({}))

    if (action === 'vapid') {
      const { publicKey } = await getServer()
      return json({ publicKey, emailConfigured: !!RESEND_API_KEY })
    }

    if (action === 'cron') return json(await runCron())

    if (action === 'test') {
      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
      const { data: { user } } = await admin.auth.getUser(token)
      if (!user) return json({ error: 'login_required' }, 401)
      const payload: Payload = {
        title: '🔔 テスト通知',
        body: '知識メモからの毎日の通知は、このように届きます。',
        url: `${SITE_URL}/dashboard/study`,
      }
      if (channel === 'email') {
        if (!user.email) return json({ error: 'no_email' }, 400)
        return json(await emailTo(user.email, payload))
      }
      return json(await pushTo(user.id, payload))
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
