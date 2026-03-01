'use client'

interface SummaryCardProps {
  title: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
  badge?: React.ReactNode
}

export default function SummaryCard({ title, children, className = '', onClick, badge }: SummaryCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}
