import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '知識メモ',
  description: '本・YouTube・Webから得た知識を整理して、クイズで楽しむアプリ',
  // iPhone で「ホーム画面に追加」したとき、アプリのように開く
  appleWebApp: { capable: true, title: '知識メモ', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#4f46e5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="text-gray-900 antialiased">{children}</body>
    </html>
  )
}
