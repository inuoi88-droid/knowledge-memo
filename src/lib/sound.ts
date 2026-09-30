'use client'

import { useSyncExternalStore } from 'react'

// 効果音は音声ファイルを読み込まず WebAudio で合成する（通信ゼロ・軽量）
let ctx: AudioContext | null = null

const MUTE_KEY = 'km:muted'
const MUTE_EVENT = 'km:muted-change'

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {}
  window.dispatchEvent(new Event(MUTE_EVENT))
}

function subscribeMuted(onChange: () => void) {
  window.addEventListener(MUTE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(MUTE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useMuted(): boolean {
  return useSyncExternalStore(subscribeMuted, readMuted, () => false)
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (!ctx || readMuted()) return
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

// ブラウザの自動再生制限のため、ユーザー操作（スタート・参加ボタンなど）の中で一度呼んでおく
export function unlockSound() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export const sfx = {
  // 出題前の「てれん！」
  jingle: () => {
    tone(784, 0, 0.12, 'triangle', 0.16)
    tone(1175, 0.1, 0.45, 'triangle', 0.16)
    tone(1568, 0.1, 0.45, 'sine', 0.06)
  },
  buzz: () => tone(880, 0, 0.25, 'square', 0.08),
  correct: () => { tone(988, 0, 0.15); tone(1319, 0.15, 0.35) },
  wrong: () => { tone(220, 0, 0.2, 'sawtooth', 0.08); tone(196, 0.2, 0.3, 'sawtooth', 0.08) },
  tap: () => tone(660, 0, 0.06, 'triangle', 0.06),
  fanfare: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.12))
    tone(1047, 0.44, 0.7, 'sine', 0.1)
  },
}

// 「てれん！」を鳴らしてから問題を始めるまでの間
export const INTRO_MS = 1100
