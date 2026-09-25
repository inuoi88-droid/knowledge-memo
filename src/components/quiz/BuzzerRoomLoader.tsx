'use client'

import dynamic from 'next/dynamic'

// ニックネームやプレイヤーIDをブラウザのストレージから読むので、サーバーでは描画しない
const BuzzerRoom = dynamic(() => import('./BuzzerRoom'), {
  ssr: false,
  loading: () => <p className="py-20 text-center text-sm text-gray-400">ルームを準備しています…</p>,
})

export default BuzzerRoom
