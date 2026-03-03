'use client'

// bg / text kept for filter-button active-state (solid color chips in filter rows)
// chipClass is the soft Tailwind class used for display chips on cards
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; chipClass: string }> = {
  Housing:       { bg: '#1B2A4A', text: '#fff', chipClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  Auto:          { bg: '#2563EB', text: '#fff', chipClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  Utilities:     { bg: '#7C3AED', text: '#fff', chipClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  Wireless:      { bg: '#0891B2', text: '#fff', chipClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' },
  Insurance:     { bg: '#065F46', text: '#fff', chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  Debt:          { bg: '#D94F3D', text: '#fff', chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
  Subscriptions: { bg: '#F0A500', text: '#fff', chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  Family:        { bg: '#2DB5AD', text: '#fff', chipClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
  Annual:        { bg: '#6B7280', text: '#fff', chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  Health:        { bg: '#DB2777', text: '#fff', chipClass: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' },
  Tech:          { bg: '#1D4ED8', text: '#fff', chipClass: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  'Credit Card': { bg: '#9333EA', text: '#fff', chipClass: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
}

interface CategoryChipProps {
  category: string
  className?: string
}

export default function CategoryChip({ category, className = '' }: CategoryChipProps) {
  const colors = CATEGORY_COLORS[category] ?? { bg: '#6B7280', text: '#fff', chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.chipClass} ${className}`}
    >
      {category}
    </span>
  )
}
