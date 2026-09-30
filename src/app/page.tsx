'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  async function signInWithGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#4338ca_0%,#1e1b4b_55%,#0c0a24_100%)] p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl sm:p-10">
        <div className="mb-3 text-5xl">📚🎯</div>
        <h1 className="mb-2 text-2xl font-black">知識メモ</h1>
        <p className="mb-5 text-sm text-gray-500">
          本・YouTube・Webから得た知識を<br />整理して、クイズで楽しむアプリ
        </p>
        <div className="mb-7 flex flex-wrap justify-center gap-1.5 text-xs font-bold">
          {['🔢 四択', '⭕ ○×', '⚡ 早押し', '🖼️ ビジュアル', '👥 みんなで対戦'].map(t => (
            <span key={t} className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{t}</span>
          ))}
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
          </svg>
          Googleでログイン
        </button>
      </div>
    </div>
  )
}
