'use client'

interface AlertBadgeProps {
  days: number
  className?: string
}

export default function AlertBadge({ days, className = '' }: AlertBadgeProps) {
  let chipClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'

  if (days < 0) {
    chipClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  } else if (days <= 14) {
    chipClass = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
  } else if (days <= 30) {
    chipClass = 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
  } else if (days <= 60) {
    chipClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  }

  const label = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0
    ? 'Today'
    : `${days}d`

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${chipClass} ${className}`}>
      {label}
    </span>
  )
}
