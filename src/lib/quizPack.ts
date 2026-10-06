import type { OwnQuiz, QuizProgress } from '@/types'

// クイズ・学習の画面には自分の全問を渡す。何千問にもなるので、
// - 問題文・解説は送らず、出題するとき・一覧に出すときに読み込む（useQuizTexts）
// - 項目名を毎行くり返さないよう配列にし、アイテムIDとタグは番号で表す
// 答えは四択の選択肢や「答えが何種類あるか」に全問分いるので送る

type QuizRow = [id: string, item: number, position: number, difficulty: number | null, tags: number[], answer: string, image: string | null]

export interface PackedQuizzes {
  items: string[]
  tags: string[]
  rows: QuizRow[]
}

export type QuizMeta = Omit<OwnQuiz, 'question' | 'explanation'>

export function packQuizzes(quizzes: readonly QuizMeta[]): PackedQuizzes {
  const items: string[] = []
  const tags: string[] = []
  const itemIdx = new Map<string, number>()
  const tagIdx = new Map<string, number>()
  const indexOf = (map: Map<string, number>, list: string[], key: string) => {
    let i = map.get(key)
    if (i === undefined) {
      i = list.push(key) - 1
      map.set(key, i)
    }
    return i
  }
  const rows = quizzes.map((q): QuizRow => [
    q.id,
    indexOf(itemIdx, items, q.item_id),
    q.position,
    q.difficulty,
    q.tags.map(t => indexOf(tagIdx, tags, t)),
    q.answer,
    q.image_url,
  ])
  return { items, tags, rows }
}

// 問題文・解説は空のまま。表示や出題の前に useQuizTexts で埋める
export function unpackQuizzes(p: PackedQuizzes): OwnQuiz[] {
  return p.rows.map(([id, item, position, difficulty, tags, answer, image]) => ({
    id,
    item_id: p.items[item],
    position,
    difficulty,
    tags: tags.map(t => p.tags[t]),
    answer,
    image_url: image,
    question: '',
    explanation: null,
  }))
}

// 学習の記録も問題の数だけ増えるので、同じように配列にし、日時は数値（ミリ秒）にする
type ProgressRow = [memoId: string, correct: number, wrong: number, level: number, lastResult: boolean | null, dueAt: number | null, introducedAt: number | null]

export type PackedProgress = ProgressRow[]

const toMs = (s: string | null) => (s ? Date.parse(s) : null)
const toIso = (n: number | null) => (n === null ? null : new Date(n).toISOString())

export function packProgress(progress: readonly QuizProgress[]): PackedProgress {
  return progress.map(p => [p.memo_id, p.correct_count, p.wrong_count, p.level, p.last_result, toMs(p.due_at), toMs(p.introduced_at)])
}

export function unpackProgress(p: PackedProgress): QuizProgress[] {
  return p.map(([memo_id, correct_count, wrong_count, level, last_result, due, introduced]) => ({
    memo_id, correct_count, wrong_count, level, last_result, due_at: toIso(due), introduced_at: toIso(introduced),
  }))
}
