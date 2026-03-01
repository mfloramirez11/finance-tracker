'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/finances/format'

interface Debt {
  id: string
  name: string
  current_balance: number
  apr: number
  min_payment: number
}

interface PayoffResult {
  name: string
  months: number
  totalInterest: number
}

function calculatePayoff(balance: number, apr: number, monthlyPayment: number): { months: number; totalInterest: number } {
  if (monthlyPayment <= 0) return { months: 999, totalInterest: 0 }
  if (apr === 0) {
    if (monthlyPayment <= 0) return { months: 999, totalInterest: 0 }
    return { months: Math.ceil(balance / monthlyPayment), totalInterest: 0 }
  }

  const monthlyRate = apr / 12
  if (monthlyPayment <= balance * monthlyRate) {
    return { months: 9999, totalInterest: 0 } // Payment too low
  }

  const months = Math.ceil(
    -Math.log(1 - (balance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate)
  )
  const totalPaid = monthlyPayment * months
  const totalInterest = Math.max(0, totalPaid - balance)
  return { months, totalInterest }
}

export default function PayoffCalculator({ debts }: { debts: Debt[] }) {
  const [extraPayment, setExtraPayment] = useState(0)

  const results: PayoffResult[] = useMemo(() => {
    return debts
      .filter((d) => d.current_balance > 0)
      .map((d) => {
        const payment = (Number(d.min_payment) || 0) + extraPayment / debts.length
        const { months, totalInterest } = calculatePayoff(
          Number(d.current_balance),
          Number(d.apr),
          payment
        )
        return { name: d.name, months, totalInterest }
      })
  }, [debts, extraPayment])

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Payoff Scenarios</h3>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Extra monthly payment</span>
          <span className="font-semibold" style={{ color: '#2DB5AD' }}>{formatCurrency(extraPayment)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={25}
          value={extraPayment}
          onChange={(e) => setExtraPayment(Number(e.target.value))}
          className="w-full accent-teal-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>$0</span>
          <span>$1,000</span>
        </div>
      </div>

      <div className="space-y-2">
        {results.map((r) => (
          <div key={r.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-700 font-medium">{r.name}</span>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {r.months >= 9999 ? '∞' : r.months >= 120
                  ? `${Math.floor(r.months / 12)}y ${r.months % 12}m`
                  : `${r.months} mo`}
              </div>
              {r.totalInterest > 0 && (
                <div className="text-xs text-red-500">{formatCurrency(r.totalInterest)} interest</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
