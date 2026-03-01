'use client'

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Housing: { bg: '#1B2A4A', text: '#fff' },
  Auto: { bg: '#2563EB', text: '#fff' },
  Utilities: { bg: '#7C3AED', text: '#fff' },
  Wireless: { bg: '#0891B2', text: '#fff' },
  Insurance: { bg: '#065F46', text: '#fff' },
  Debt: { bg: '#D94F3D', text: '#fff' },
  Subscriptions: { bg: '#F0A500', text: '#fff' },
  Family: { bg: '#2DB5AD', text: '#fff' },
  Annual: { bg: '#6B7280', text: '#fff' },
  Health: { bg: '#DB2777', text: '#fff' },
  Tech: { bg: '#1D4ED8', text: '#fff' },
  'Credit Card': { bg: '#9333EA', text: '#fff' },
}

interface CategoryChipProps {
  category: string
  className?: string
}

export default function CategoryChip({ category, className = '' }: CategoryChipProps) {
  const colors = CATEGORY_COLORS[category] ?? { bg: '#6B7280', text: '#fff' }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {category}
    </span>
  )
}
