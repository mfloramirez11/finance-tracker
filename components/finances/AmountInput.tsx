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
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-sm"
          style={{ color: 'var(--text-3)' }}
        >$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-6 pr-2 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 text-right"
          style={{
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text)',
            border: '1px solid var(--input-border)',
          }}
        />
      </div>
    )
  }

  return (
    <div className={className}>
      {label && (
        <label
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--text-2)' }}
        >
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 font-medium"
          style={{ color: 'var(--text-2)' }}
        >$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full pl-7 pr-3 py-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          style={{
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text)',
            border: '1px solid var(--input-border)',
            minHeight: 44,
          }}
        />
      </div>
    </div>
  )
}
