'use client'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
  required?: boolean
  compact?: boolean  // no label, smaller padding, no wrapper div
}

export default function AmountInput({ value, onChange, placeholder = '0.00', className = '', label, required, compact }: AmountInputProps) {
  if (compact) {
    return (
      <div className={`relative flex-1 ${className}`}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 text-right"
        />
      </div>
    )
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full pl-7 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          style={{ minHeight: 44 }}
        />
      </div>
    </div>
  )
}
