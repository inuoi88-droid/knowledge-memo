import type { User } from '@supabase/supabase-js'

// 公開するときの作者名の初期値
export function displayName(user: User | null): string {
  const meta = user?.user_metadata ?? {}
  return meta.full_name || meta.name || user?.email?.split('@')[0] || '名無し'
}
