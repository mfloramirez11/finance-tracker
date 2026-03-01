'use client'

interface LoadingSkeletonProps {
  rows?: number
  className?: string
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

export default function LoadingSkeleton({ rows = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
          <SkeletonBlock className="h-4 w-1/3 mb-2" />
          <SkeletonBlock className="h-6 w-2/3 mb-2" />
          <SkeletonBlock className="h-2 w-full" />
        </div>
      ))}
    </div>
  )
}
