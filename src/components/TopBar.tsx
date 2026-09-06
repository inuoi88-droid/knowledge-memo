'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function TopBar({ user }: { user: User }) {
  const supabase = createClient()
  const router = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-5 gap-3 sticky top-0 z-50">
      <span className="font-bold text-sm flex-1">📚 知識メモ</span>
      <span className="text-xs text-gray-400">{user.email}</span>
      <button
        onClick={signOut}
        className="text-xs text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50"
      >
        ログアウト
      </button>
    </header>
  )
}
