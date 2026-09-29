import { answerSearchUrl } from '@/lib/quiz'

export default function AnswerSearchLink({ answer, className = '' }: { answer: string; className?: string }) {
  return (
    <a
      href={answerSearchUrl(answer)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`「${answer}」をGoogleで検索`}
      className={`inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-indigo-300 hover:text-indigo-700 ${className}`}
    >
      🔍 検索
    </a>
  )
}
