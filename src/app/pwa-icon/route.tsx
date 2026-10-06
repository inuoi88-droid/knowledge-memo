import { ImageResponse } from 'next/og'
import { AppIcon } from '@/lib/appIcon'

// マニフェスト・通知用のアイコン。/pwa-icon?size=192 のように使う
export function GET(req: Request) {
  const requested = Number(new URL(req.url).searchParams.get('size'))
  const size = [72, 96, 192, 512].includes(requested) ? requested : 512
  return new ImageResponse(<AppIcon size={size} />, {
    width: size,
    height: size,
    headers: { 'Cache-Control': 'public, max-age=86400, immutable' },
  })
}
