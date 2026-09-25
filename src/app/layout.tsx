import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '知識メモ',
  description: '本・YouTube・Webから得た知識を整理して、クイズで楽しむアプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="text-gray-900 antialiased">{children}</body>
    </html>
  )
}
