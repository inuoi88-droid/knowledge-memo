'use client'

import { useEffect, useState } from 'react'

// 画像つきの問題は、画像を先に見せてから問題文を読み上げる
export const IMAGE_LEAD_MS = 1500
// 画像つきの問題は読み上げをゆっくりにする（通常の何倍の時間をかけるか）
export const IMAGE_CHAR_FACTOR = 1.5
// 画像の読み込みを待つのはここまで（それ以上かかる場合は画像なしで進める）
export const IMAGE_WAIT_MAX_MS = 5000

const cache = new Map<string, Promise<boolean>>()

// 画像を先読みする。読み込めたら true、失敗・時間切れなら false。同じ URL は1回だけ読み込む
export function preloadImage(src: string, timeoutMs = 10000): Promise<boolean> {
  let p = cache.get(src)
  if (!p) {
    p = new Promise<boolean>(resolve => {
      const img = new Image()
      const timer = setTimeout(() => resolve(false), timeoutMs)
      img.onload = () => { clearTimeout(timer); resolve(true) }
      img.onerror = () => { clearTimeout(timer); resolve(false) }
      img.referrerPolicy = 'no-referrer'
      img.src = src
    })
    cache.set(src, p)
  }
  return p
}

export function waitForImage(src: string | null, maxMs = IMAGE_WAIT_MAX_MS): Promise<void> {
  if (!src) return Promise.resolve()
  return Promise.race([preloadImage(src), new Promise(r => setTimeout(r, maxMs))]).then(() => undefined)
}

// この画像の読み込みが終わったか（失敗も「終わった」に含める）。画像がなければ true
export function useImageReady(src: string | null | undefined): boolean {
  const [doneSrc, setDoneSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!src) return
    let alive = true
    void preloadImage(src).then(() => { if (alive) setDoneSrc(src) })
    return () => { alive = false }
  }, [src])
  return !src || doneSrc === src
}
