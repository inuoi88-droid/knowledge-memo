import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'

export default async function QuizPublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href={user ? '/dashboard' : '/'} className="shrink-0 whitespace-nowrap text-base font-bold tracking-tight text-gray-900">知識メモ</Link>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">🎯 クイズ</span>
          <div className="ml-auto min-w-0 truncate text-sm">
            {user ? (
              <Link href="/dashboard/quiz" className="text-gray-500 hover:text-indigo-600">クイズタブへ →</Link>
            ) : (
              <Link href="/" className="text-gray-500 hover:text-indigo-600">
                ログイン<span className="hidden sm:inline">して自分のクイズを作る</span> →
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-20">{children}</main>
    </div>
  )
}
