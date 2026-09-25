'use client'

import { useSyncExternalStore } from 'react'

export type Density = 'compact' | 'normal' | 'large'

const KEY = 'km:density'
const EVENT = 'km:density-change'

function read(): Density {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'compact' || v === 'normal' || v === 'large') return v
  } catch {}
  return 'normal'
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

export function setDensity(d: Density) {
  try {
    localStorage.setItem(KEY, d)
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

export function useDensity(): Density {
  return useSyncExternalStore(subscribe, read, () => 'normal')
}
