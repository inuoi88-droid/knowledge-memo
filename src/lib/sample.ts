import { createClient } from './supabase/client'

// はじめての人が「今日の学習」をすぐ試せるサンプル
const SAMPLE_QUIZZES: [string, string, string][] = [
  ['北海道の道庁所在地は？', '札幌(さっぽろ)', '北海道の中心都市。雪まつりで有名'],
  ['宮城県の県庁所在地は？', '仙台(せんだい)', '「杜の都」と呼ばれる東北最大の都市'],
  ['栃木県の県庁所在地は？', '宇都宮(うつのみや)', 'ぎょうざの街として知られる'],
  ['群馬県の県庁所在地は？', '前橋(まえばし)', '高崎市とまちがえやすいので注意'],
  ['神奈川県の県庁所在地は？', '横浜(よこはま)', '日本でいちばん人口の多い市'],
  ['石川県の県庁所在地は？', '金沢(かなざわ)', '兼六園がある'],
  ['山梨県の県庁所在地は？', '甲府(こうふ)', '武田信玄ゆかりの地'],
  ['愛知県の県庁所在地は？', '名古屋(なごや)', '名古屋城のしゃちほこが有名'],
  ['兵庫県の県庁所在地は？', '神戸(こうべ)', '港町。神戸牛でも知られる'],
  ['島根県の県庁所在地は？', '松江(まつえ)', '宍道湖のほとりにある城下町'],
  ['香川県の県庁所在地は？', '高松(たかまつ)', 'うどん県の中心'],
  ['沖縄県の県庁所在地は？', '那覇(なは)', '首里城がある'],
]

export const SAMPLE_COUNT = SAMPLE_QUIZZES.length

export async function createSample(): Promise<{ shelfId: string; itemId: string } | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }
  const { data: shelf, error: e1 } = await supabase.from('shelves').insert({ name: 'サンプル', user_id: user.id }).select('id').single()
  if (e1 || !shelf) return { error: e1?.message ?? '本棚を作れませんでした' }
  const { data: item, error: e2 } = await supabase
    .from('items')
    .insert({ shelf_id: shelf.id, user_id: user.id, title: '都道府県の県庁所在地（サンプル）', source_type: 'other' })
    .select('id')
    .single()
  if (e2 || !item) return { error: e2?.message ?? 'アイテムを作れませんでした' }
  const { error: e3 } = await supabase.from('memos').insert(
    SAMPLE_QUIZZES.map(([question, answer, explanation]) => ({
      item_id: item.id, user_id: user.id, type: 'qa', question, answer, explanation, difficulty: 1, tags: ['地理'],
    })),
  )
  if (e3) return { error: e3.message }
  return { shelfId: shelf.id, itemId: item.id }
}
