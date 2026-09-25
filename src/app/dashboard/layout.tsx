import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import TopBar from '@/components/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/')

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-20">
        {children}
      </main>
    </div>
  )
}
