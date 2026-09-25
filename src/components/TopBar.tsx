'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const TABS = [
  { href: '/dashboard', label: '本棚', icon: '📚', isActive: (p: string) => !p.startsWith('/dashboard/quiz') },
  { href: '/dashboard/quiz', label: 'クイズ', icon: '🎯', isActive: (p: string) => p.startsWith('/dashboard/quiz') },
]

export default function TopBar({ user }: { user: User }) {
  const router = useRouter()
  const pathname = usePathname()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-6">
        <Link href="/dashboard" className="shrink-0 text-base font-bold tracking-tight text-gray-900">
          知識メモ
        </Link>
        <nav className="flex h-full items-stretch">
          {TABS.map(t => {
            const active = t.isActive(pathname)
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-sm font-medium transition-colors sm:px-3 ${
                  active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-48 truncate text-xs text-gray-400 md:inline">{user.email}</span>
          <button onClick={signOut} className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800">
            ログアウト
          </button>
        </div>
      </div>
    </header>
  )
}
