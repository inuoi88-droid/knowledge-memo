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
  tags: string[]
  created_at: string
}
