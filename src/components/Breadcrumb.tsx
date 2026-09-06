import Link from 'next/link'
import type { Shelf, Item } from '@/types'

interface Props {
  shelf: Shelf
  item?: Item
}

export default function Breadcrumb({ shelf, item }: Props) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
      <Link href="/dashboard" className="hover:text-blue-500 hover:underline">本棚</Link>
      <span>›</span>
      {item ? (
        <>
          <Link href={`/dashboard/${shelf.id}`} className="hover:text-blue-500 hover:underline">
            {shelf.name}
          </Link>
          <span>›</span>
          <span className="text-gray-600">{item.title}</span>
        </>
      ) : (
        <span className="text-gray-600">{shelf.name}</span>
      )}
    </nav>
  )
}
