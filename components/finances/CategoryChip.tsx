'use client'

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; softBg: string; softText: string }> = {
  Housing:       { bg: '#1B2A4A', text: '#fff', softBg: '#EEF2FF', softText: '#1B2A4A' },
  Auto:          { bg: '#2563EB', text: '#fff', softBg: '#DBEAFE', softText: '#1E40AF' },
  Utilities:     { bg: '#7C3AED', text: '#fff', softBg: '#EDE9FE', softText: '#5B21B6' },
  Wireless:      { bg: '#0891B2', text: '#fff', softBg: '#CFFAFE', softText: '#0E7490' },
  Insurance:     { bg: '#065F46', text: '#fff', softBg: '#D1FAE5', softText: '#065F46' },
  Debt:          { bg: '#D94F3D', text: '#fff', softBg: '#FEE2E2', softText: '#B91C1C' },
  Subscriptions: { bg: '#F0A500', text: '#fff', softBg: '#FEF3C7', softText: '#92400E' },
  Family:        { bg: '#2DB5AD', text: '#fff', softBg: '#CCFBF1', softText: '#0F766E' },
  Annual:        { bg: '#6B7280', text: '#fff', softBg: '#F3F4F6', softText: '#374151' },
  Health:        { bg: '#DB2777', text: '#fff', softBg: '#FCE7F3', softText: '#9D174D' },
  Tech:          { bg: '#1D4ED8', text: '#fff', softBg: '#DBEAFE', softText: '#1E40AF' },
  'Credit Card': { bg: '#9333EA', text: '#fff', softBg: '#F3E8FF', softText: '#6B21A8' },
}

interface CategoryChipProps {
  category: string
  className?: string
}

export default function CategoryChip({ category, className = '' }: CategoryChipProps) {
  const colors = CATEGORY_COLORS[category] ?? { bg: '#6B7280', text: '#fff', softBg: '#F3F4F6', softText: '#374151' }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: colors.softBg, color: colors.softText }}
    >
      {category}
    </span>
  )
}
