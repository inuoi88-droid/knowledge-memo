import type { Memo, Quiz } from '@/types'

export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'かんたん',
  2: 'やさしめ',
  3: 'ふつう',
  4: 'むずかしめ',
  5: 'むずかしい',
}

const DIFFICULTY_WORDS: Record<string, number> = {
  かんたん: 1, 簡単: 1, 易: 1, 易しい: 1, 初級: 1, easy: 1,
  やさしめ: 2, やや易: 2,
  ふつう: 3, 普通: 3, 中級: 3, 普: 3, normal: 3,
  むずかしめ: 4, やや難: 4,
  むずかしい: 5, 難しい: 5, 難: 5, 上級: 5, hard: 5,
}

export function parseDifficulty(raw: string | null | undefined): number | null {
  const s = (raw ?? '').normalize('NFKC').trim().toLowerCase()
  if (!s) return null
  const stars = (s.match(/★/g) ?? []).length
  if (stars > 0) return Math.min(5, stars)
  const n = Number.parseInt(s, 10)
  if (!Number.isNaN(n)) return n >= 1 && n <= 5 ? n : null
  return DIFFICULTY_WORDS[s] ?? null
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,、\s]+/)
    .map(t => t.replace(/^#/, '').trim())
    .filter(Boolean)
}

export function toQuiz(m: Pick<Memo, 'id' | 'question' | 'answer' | 'explanation' | 'difficulty' | 'tags'>): Quiz {
  return {
    id: m.id,
    question: m.question ?? '',
    answer: m.answer ?? '',
    explanation: m.explanation ?? null,
    difficulty: m.difficulty ?? null,
    tags: m.tags ?? [],
  }
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---- スプレッドシート貼り付け ----

export type BulkField = 'question' | 'answer' | 'genre' | 'difficulty' | 'explanation'

// 見出し行が無いときの列の並び。旧形式（問題・答え・タグ）の貼り付けもそのまま読める順にしている
export const BULK_DEFAULT_ORDER: BulkField[] = ['question', 'answer', 'genre', 'difficulty', 'explanation']

export const BULK_FIELD_LABELS: Record<BulkField, string> = {
  question: '問題',
  answer: '答え',
  genre: 'ジャンル',
  difficulty: '難易度',
  explanation: '解説',
}

export const BULK_TEMPLATE = BULK_DEFAULT_ORDER.map(f => BULK_FIELD_LABELS[f]).join('\t')

const HEADER_ALIASES: Record<BulkField, string[]> = {
  question: ['問題', '質問', '問い', '問', 'q', 'question'],
  answer: ['答え', '回答', '解答', '正解', 'a', 'answer'],
  genre: ['ジャンル', 'タグ', 'カテゴリ', 'カテゴリー', 'genre', 'tag', 'tags', 'category'],
  difficulty: ['難易度', 'レベル', '難しさ', 'difficulty', 'level'],
  explanation: ['解説', '説明', '補足', 'explanation', 'note'],
}

function headerField(cell: string): BulkField | null {
  const c = cell.normalize('NFKC').trim().toLowerCase()
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [BulkField, string[]][]) {
    if (aliases.includes(c)) return field
  }
  return null
}

export interface BulkQuizRow {
  question: string
  answer: string
  explanation: string | null
  difficulty: number | null
  tags: string[]
}

export function parseBulkQuiz(text: string): { rows: BulkQuizRow[]; order: BulkField[]; hasHeader: boolean } {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.split('\t').map(cell => cell.trim()))
    .filter(cols => cols.some(Boolean))

  let order: (BulkField | null)[] = BULK_DEFAULT_ORDER
  let hasHeader = false
  if (lines.length > 0) {
    const mapped = lines[0].map(headerField)
    if (mapped.includes('question') && mapped.includes('answer')) {
      order = mapped
      hasHeader = true
      lines.shift()
    }
  }

  const rows: BulkQuizRow[] = []
  for (const cols of lines) {
    const get = (f: BulkField) => {
      const i = order.indexOf(f)
      return i >= 0 ? (cols[i] ?? '') : ''
    }
    const question = get('question')
    const answer = get('answer')
    if (!question || !answer) continue
    rows.push({
      question,
      answer,
      explanation: get('explanation') || null,
      difficulty: parseDifficulty(get('difficulty')),
      tags: parseTags(get('genre')),
    })
  }
  return { rows, order: order.filter((f): f is BulkField => f !== null), hasHeader }
}

// ---- 早押しの自動判定 ----

export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・、。,.!?「」『』()[\]【】〜~"'“”‘’]/g, '')
}

// 「函館（はこだて）」「札幌/さっぽろ」のような答えは、それぞれの表記を正解として扱う
export function acceptableAnswers(answer: string): string[] {
  const nfkc = answer.normalize('NFKC')
  const parts = nfkc.split(/[/|]/)
  const out = new Set<string>()
  for (const p of parts) {
    const base = p.replace(/\(.*?\)/g, '')
    out.add(normalizeAnswer(base))
    for (const m of p.matchAll(/\((.*?)\)/g)) out.add(normalizeAnswer(m[1]))
    out.add(normalizeAnswer(p))
  }
  out.delete('')
  return [...out]
}

export function isCorrectAnswer(input: string, answer: string): boolean {
  const n = normalizeAnswer(input)
  if (!n) return false
  return acceptableAnswers(answer).includes(n)
}
