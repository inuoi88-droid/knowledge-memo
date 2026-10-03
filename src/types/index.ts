export type SourceType = 'book' | 'youtube' | 'web' | 'other'
export type MemoType = 'quote' | 'thought' | 'qa'

export interface Shelf {
  id: string
  user_id: string
  name: string
  created_at: string
  is_public?: boolean
  author_name?: string | null
  item_count?: number
  memo_count?: number
}

export interface Item {
  id: string
  shelf_id: string
  user_id: string
  title: string
  author: string | null
  url: string | null
  source_type: SourceType
  created_at: string
  is_public?: boolean
  author_name?: string | null
  memo_count?: number
}

export interface Memo {
  id: string
  item_id: string
  user_id: string
  type: MemoType
  text: string | null
  question: string | null
  answer: string | null
  explanation: string | null
  difficulty: number | null
  tags: string[]
  image_url: string | null
  position: number
  created_at: string
}

export interface Quiz {
  id: string
  question: string
  answer: string
  explanation: string | null
  difficulty: number | null
  tags: string[]
  image_url: string | null
}

export interface QuizWithSource extends Quiz {
  item_id: string
  item_title: string | null
  shelf_id: string | null
  // 追加した順（スプレッドシートの上から）。「初めから」学習の順番
  position: number
}

// 本棚とその中のアイテム（範囲を選ぶ画面用）
export interface ShelfNode {
  id: string
  name: string
  is_public: boolean
  items: { id: string; title: string; source_type: SourceType; is_public: boolean }[]
}

// 公開・早押しの単位
export interface QuizSource {
  kind: 'shelf' | 'item'
  id: string
}

export interface PublicSource extends QuizSource {
  title: string
  author_name: string | null
  quiz_count: number
  published_at: string | null
  is_mine: boolean
}

export interface QuizProgress {
  memo_id: string
  correct_count: number
  wrong_count: number
  level: number
  last_result: boolean | null
  last_answered_at: string | null
  due_at: string | null
  introduced_at: string | null
}

export interface StudySettingsRow {
  review_days: number[]
  check_repeats: number
  review_style: string
  daily_new: number
  new_order: string
  scope_shelf_ids: string[]
  scope_item_ids: string[]
}

export interface PlaySessionRecord {
  id: number
  title: string
  mode: string
  rule: string
  total: number
  correct: number
  max_combo: number
  duration_ms: number
  created_at: string
}
