'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import ProgressBar from '@/components/finances/ProgressBar'
import AlertBadge from '@/components/finances/AlertBadge'
import AmountInput from '@/components/finances/AmountInput'
import PayoffCalculator from '@/components/finances/PayoffCalculator'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, formatDate, daysUntil } from '@/lib/finances/format'

interface Debt {
  id: string
  name: string
  current_balance: number
  original_balance: number
  apr: number
  min_payment: number
  promo_end_date: string | null
  promo_apr: number | null
  account: string | null
  notes: string | null
  total_paid: number
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [totalDebt, setTotalDebt] = useState(0)
  const [totalMin, setTotalMin] = useState(0)

  // Payment sheet
  const [paySheetOpen, setPaySheetOpen] = useState(false)
  const [selected, setSelected] = useState<Debt | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false)
  const [editBalance, setEditBalance] = useState('')
  const [editApr, setEditApr] = useState('')
  const [editMin, setEditMin] = useState('')

  const fetchDebts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/finances/debts')
    const json = await res.json()
    if (json.data) {
      setDebts(json.data.debts ?? [])
      setTotalDebt(json.data.totalDebt ?? 0)
      setTotalMin(json.data.totalMinPayment ?? 0)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchDebts() }, [fetchDebts])

  function openPayment(debt: Debt) {
    setSelected(debt)
    setPayAmount(String(debt.min_payment ?? ''))
    setPayDate(new Date().toISOString().split('T')[0])
    setPaySheetOpen(true)
  }

  function openEdit(debt: Debt) {
    setSelected(debt)
    setEditBalance(String(debt.current_balance))
    setEditApr(String(Number(debt.apr) * 100))
    setEditMin(String(debt.min_payment ?? ''))
    setEditOpen(true)
  }

  async function submitPayment() {
    if (!selected || !payAmount) return
    setSaving(true)
    await fetch(`/api/finances/debts/${selected.id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(payAmount), payment_date: payDate }),
    })
    setSaving(false)
    setPaySheetOpen(false)
    fetchDebts()
  }

  async function submitEdit() {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/finances/debts/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_balance: parseFloat(editBalance),
        apr: parseFloat(editApr) / 100,
        min_payment: parseFloat(editMin),
      }),
    })
    setSaving(false)
    setEditOpen(false)
    fetchDebts()
  }

  return (
    <FinanceLayout title="Debt Tracker">
      {loading ? <LoadingSkeleton rows={4} /> : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total Debt</p>
                <p className="text-2xl font-bold" style={{ color: '#D94F3D' }}>{formatCurrency(totalDebt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Min Payments / mo</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalMin)}</p>
              </div>
            </div>
          </div>

          {/* Debt cards */}
          {debts.map(debt => {
            const paid = parseFloat(String(debt.total_paid)) || 0
            const original = parseFloat(String(debt.original_balance)) || parseFloat(String(debt.current_balance))
            const current = parseFloat(String(debt.current_balance))
            const paidPct = original > 0 ? ((original - current) / original) * 100 : 0
            const apr = parseFloat(String(debt.apr))
            const isPromo = apr === 0 && debt.promo_end_date
            const promoDays = debt.promo_end_date ? daysUntil(debt.promo_end_date.split('T')[0]) : null

            return (
              <div key={debt.id} className="bg-white rounded-2xl p-4 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900">{debt.name}</h3>
                    {debt.account && <p className="text-xs text-gray-400 mt-0.5">{debt.account}</p>}
                  </div>
                  <button
                    onClick={() => openEdit(debt)}
                    className="ml-2 text-xs text-gray-400 px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                </div>

                {/* Promo alert */}
                {isPromo && promoDays !== null && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl" style={{ backgroundColor: promoDays <= 30 ? '#FEE2E2' : '#FEF3C7' }}>
                    <span className="text-sm">⚠️</span>
                    <span className="text-xs font-medium text-gray-700">
                      0% promo ends {formatDate(debt.promo_end_date!.split('T')[0])}
                    </span>
                    <AlertBadge days={promoDays} className="ml-auto" />
                  </div>
                )}

                {/* Balance + APR */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Balance</p>
                    <p className="text-lg font-bold" style={{ color: '#D94F3D' }}>{formatCurrency(current)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">APR</p>
                    <p className="text-base font-semibold text-gray-900">
                      {isPromo ? <span className="text-green-600">0%</span> : `${(apr * 100).toFixed(2)}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Min Payment</p>
                    <p className="text-base font-semibold text-gray-900">{formatCurrency(debt.min_payment)}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Paid off {paidPct.toFixed(0)}%</span>
                    <span>{formatCurrency(original - current)} of {formatCurrency(original)}</span>
                  </div>
                  <ProgressBar value={paidPct} color="#27AE60" />
                </div>

                {/* Payment button */}
                <button
                  onClick={() => openPayment(debt)}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: '#2DB5AD' }}
                >
                  Log Payment
                </button>
              </div>
            )
          })}

          {/* Payoff calculator */}
          <PayoffCalculator debts={debts} />
        </div>
      )}

      {/* Log Payment Sheet */}
      <BottomSheet open={paySheetOpen} onClose={() => setPaySheetOpen(false)} title={`Pay: ${selected?.name}`}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400">Current Balance</p>
              <p className="text-lg font-bold" style={{ color: '#D94F3D' }}>{formatCurrency(selected.current_balance)}</p>
            </div>

            <AmountInput label="Payment Amount" value={payAmount} onChange={setPayAmount} required />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setPaySheetOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
              <button onClick={submitPayment} disabled={saving || !payAmount} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#2DB5AD' }}>
                {saving ? 'Saving…' : 'Log Payment'}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Edit Balance Sheet */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title={`Edit: ${selected?.name}`}>
        {selected && (
          <div className="space-y-4">
            <AmountInput label="Current Balance" value={editBalance} onChange={setEditBalance} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">APR (%)</label>
              <input
                type="number"
                step="0.01"
                value={editApr}
                onChange={e => setEditApr(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
              />
            </div>

            <AmountInput label="Min Payment" value={editMin} onChange={setEditMin} />

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
              <button onClick={submitEdit} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#1B2A4A' }}>
                {saving ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </FinanceLayout>
  )
}
