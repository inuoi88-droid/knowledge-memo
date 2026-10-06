import type { MetadataRoute } from 'next'

// ホーム画面に追加して使うための設定（iPhone の通知にはホーム画面への追加が必要）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '知識メモ',
    short_name: '知識メモ',
    description: '本・YouTube・Webから得た知識をクイズにして、毎日の学習で身につけるアプリ',
    start_url: '/dashboard/study',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    lang: 'ja',
    icons: [
      { src: '/pwa-icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
