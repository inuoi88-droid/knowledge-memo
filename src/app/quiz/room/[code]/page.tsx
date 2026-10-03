import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isValidRoomCode, roomSourceFromParams } from '@/lib/room'
import BuzzerRoom from '@/components/quiz/BuzzerRoomLoader'

export const metadata: Metadata = { title: '早押しクイズ | 知識メモ' }

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ shelf?: string; item?: string; local?: string; host?: string }>
}) {
  const [{ code }, sp] = await Promise.all([params, searchParams])
  const upper = code.toUpperCase()
  if (!isValidRoomCode(upper)) notFound()

  return (
    <BuzzerRoom
      code={upper}
      source={roomSourceFromParams(sp)}
      local={sp.local === '1'}
      wantsHost={sp.host === '1'}
    />
  )
}
