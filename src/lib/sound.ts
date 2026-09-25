let ctx: AudioContext | null = null

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + duration)
}

// ブラウザの自動再生制限のため、ユーザー操作（参加ボタンなど）の中で一度呼んでおく
export function unlockSound() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export const sfx = {
  buzz: () => tone(880, 0, 0.25, 'square', 0.08),
  correct: () => { tone(988, 0, 0.15); tone(1319, 0.15, 0.35) },
  wrong: () => { tone(220, 0, 0.2, 'sawtooth', 0.08); tone(196, 0.2, 0.3, 'sawtooth', 0.08) },
}
