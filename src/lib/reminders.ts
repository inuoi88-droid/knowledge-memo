import { createClient } from './supabase/client'

export interface ReminderSettings {
  pushEnabled: boolean
  emailEnabled: boolean
  // 日本時間・0時からの分（15分きざみ）
  remindMinute: number
  lastSentOn: string | null
}

export const DEFAULT_REMINDER: ReminderSettings = { pushEnabled: false, emailEnabled: false, remindMinute: 20 * 60, lastSentOn: null }

export const REMINDER_COLUMNS = 'push_enabled, email_enabled, remind_minute, last_sent_on'

export function toReminderSettings(row: { push_enabled: boolean; email_enabled: boolean; remind_minute: number; last_sent_on: string | null } | null): ReminderSettings {
  if (!row) return DEFAULT_REMINDER
  return { pushEnabled: row.push_enabled, emailEnabled: row.email_enabled, remindMinute: row.remind_minute, lastSentOn: row.last_sent_on }
}

export function formatMinute(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const REMIND_TIMES = Array.from({ length: 96 }, (_, i) => i * 15)

// 日本時間の今日の日付と、0時からの分
function jstNow(): { today: string; minute: number } {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return { today: d.toISOString().slice(0, 10), minute: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

export async function saveReminderSettings(s: ReminderSettings): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'ログインが必要です'
  // 今日の時刻をもう過ぎていたら、最初の通知は明日から（設定した直後に届かないように）
  const { today, minute } = jstNow()
  const lastSentOn = s.remindMinute <= minute || s.lastSentOn === today ? today : s.lastSentOn
  const { error } = await supabase.from('reminder_settings').upsert({
    user_id: user.id,
    push_enabled: s.pushEnabled,
    email_enabled: s.emailEnabled,
    remind_minute: s.remindMinute,
    last_sent_on: lastSentOn,
    updated_at: new Date().toISOString(),
  })
  return error?.message ?? null
}
