'use client'

interface ProgressBarProps {
  value: number       // 0-100
  color?: string      // tailwind bg class or hex
  height?: string     // tailwind h- class
  className?: string
}

export default function ProgressBar({ value, color, height = 'h-2', className = '' }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))
  const bgColor = color ?? (clampedValue >= 90 ? '#D94F3D' : clampedValue >= 70 ? '#F39C12' : '#2DB5AD')

  return (
    <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${height} ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clampedValue}%`, backgroundColor: bgColor }}
      />
    </div>
  )
}
