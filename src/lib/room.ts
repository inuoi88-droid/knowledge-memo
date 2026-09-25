import type { Quiz } from '@/types'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,12}$/.test(code)
}

// セットを保存せずに今の絞り込み結果で早押しする場合、問題はホストのタブ内だけに置く
const LOCAL_KEY = (code: string) => `km:room:${code}`

export function stashLocalRoomQuizzes(code: string, title: string, quizzes: Quiz[]) {
  sessionStorage.setItem(LOCAL_KEY(code), JSON.stringify({ title, quizzes }))
}

export function readLocalRoomQuizzes(code: string): { title: string; quizzes: Quiz[] } | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_KEY(code))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function roomUrl(code: string, opts?: { setId?: string; local?: boolean }) {
  const params = new URLSearchParams()
  if (opts?.setId) params.set('set', opts.setId)
  if (opts?.local) params.set('local', '1')
  if (opts?.setId || opts?.local) params.set('host', '1')
  const q = params.toString()
  return `/quiz/room/${code}${q ? `?${q}` : ''}`
}
