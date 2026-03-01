'use client'

interface EmptyStateProps {
  icon?: string
  message: string
  submessage?: string
}

export default function EmptyState({ icon = '📭', message, submessage }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-gray-600 font-medium">{message}</p>
      {submessage && <p className="text-gray-400 text-sm mt-1">{submessage}</p>}
    </div>
  )
}
