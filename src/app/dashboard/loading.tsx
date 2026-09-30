// ページ切り替え中に固まって見えないよう、軽いスケルトンを出す
export default function DashboardLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="読み込み中">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="h-36 rounded-3xl bg-gray-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
    </div>
  )
}
