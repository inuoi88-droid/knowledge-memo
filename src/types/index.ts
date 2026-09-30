export type SourceType = 'book' | 'youtube' | 'web' | 'other'
export type MemoType = 'quote' | 'thought' | 'qa'

export interface Shelf {
  id: string
  user_id: string
  name: string
  created_at: string
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
}

export interface QuizProgress {
  memo_id: string
  correct_count: number
  wrong_count: number
  level: number
  last_result: boolean | null
  last_answered_at: string | null
  due_at: string | null
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

export interface QuizSet {
  id: string
  user_id: string
  title: string
  description: string | null
  author_name: string | null
  is_public: boolean
  created_at: string
  quiz_count: number
}
