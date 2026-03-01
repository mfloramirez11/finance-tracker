'use client'

interface AlertBadgeProps {
  days: number
  className?: string
}

export default function AlertBadge({ days, className = '' }: AlertBadgeProps) {
  let bg = '#27AE60'
  let text = 'text-white'

  if (days < 0) {
    bg = '#6B7280'
  } else if (days <= 14) {
    bg = '#D94F3D'
  } else if (days <= 30) {
    bg = '#F39C12'
  } else if (days <= 60) {
    bg = '#F0A500'
  }

  const label = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0
    ? 'Today'
    : `${days}d`

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${text} ${className}`}
      style={{ backgroundColor: bg }}
    >
      {label}
    </span>
  )
}
