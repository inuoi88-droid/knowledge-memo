type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>

// Supabase(PostgREST) は1回の問い合わせで返す件数に上限（既定1000件）があるため、範囲を分けて全件取得する。
// page には select(..., { count: 'exact' }) と一意な並び順（id などの同順位の決め手を含む）を付けること。
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>, size = 1000): Promise<T[]> {
  const first = await page(0, size - 1)
  if (first.error) throw new Error(first.error.message)
  const rows = [...(first.data ?? [])]
  const total = first.count ?? rows.length
  // サーバー側の上限が size より小さい場合は、実際に返ってきた件数で区切る
  const step = rows.length
  if (step === 0 || total <= step) return rows

  const rest = await Promise.all(
    Array.from({ length: Math.ceil(total / step) - 1 }, (_, i) => page((i + 1) * step, (i + 2) * step - 1)),
  )
  for (const r of rest) {
    if (r.error) throw new Error(r.error.message)
    rows.push(...(r.data ?? []))
  }
  return rows
}
