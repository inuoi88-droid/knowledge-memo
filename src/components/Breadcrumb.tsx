import Link from 'next/link'
import type { Shelf, Item } from '@/types'

export default function Breadcrumb({ shelf, item }: { shelf: Shelf; item?: Item }) {
  return (
    <nav className="mb-4 flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
      <Link href="/dashboard" className="shrink-0 hover:text-indigo-600">📚 本棚</Link>
      <span className="text-gray-300">/</span>
      {item ? (
        <>
          <Link href={`/dashboard/${shelf.id}`} className="truncate hover:text-indigo-600">{shelf.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="truncate font-medium text-gray-800">{item.title}</span>
        </>
      ) : (
        <span className="truncate font-medium text-gray-800">{shelf.name}</span>
      )}
    </nav>
  )
}
