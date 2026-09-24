import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import TopBar from '@/components/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/')

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar user={user} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 pb-20">
        {children}
      </main>
    </div>
  )
}
