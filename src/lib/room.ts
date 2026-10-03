import type { Quiz, QuizSource } from '@/types'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,12}$/.test(code)
}

// 本棚・アイテム以外（今の絞り込み結果）で早押しする場合、問題はホストのタブ内だけに置く
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

export function roomUrl(code: string, opts?: { source?: QuizSource; local?: boolean }) {
  const params = new URLSearchParams()
  if (opts?.source) params.set(opts.source.kind, opts.source.id)
  if (opts?.local) params.set('local', '1')
  if (opts?.source || opts?.local) params.set('host', '1')
  const q = params.toString()
  return `/quiz/room/${code}${q ? `?${q}` : ''}`
}

export function roomSourceFromParams(p: { shelf?: string; item?: string }): QuizSource | null {
  const uuid = /^[0-9a-f-]{36}$/i
  if (p.item && uuid.test(p.item)) return { kind: 'item', id: p.item }
  if (p.shelf && uuid.test(p.shelf)) return { kind: 'shelf', id: p.shelf }
  return null
}
