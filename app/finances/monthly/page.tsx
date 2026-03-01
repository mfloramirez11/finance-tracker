'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import ProgressBar from '@/components/finances/ProgressBar'
import CategoryChip from '@/components/finances/CategoryChip'
import AmountInput from '@/components/finances/AmountInput'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, monthName, shortMonthName } from '@/lib/finances/format'

interface BillRow {
  bill_id: string
  name: string
  category: string
  billing_type: string
  default_amount: number | null
  account: string | null
  due_day: string | null
  actual_id: string | null
  actual_amount: number | null
  is_paid: boolean
  paid_date: string | null
  actual_notes: string | null
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const CATEGORIES = ['All', 'Housing', 'Auto', 'Utilities', 'Wireless', 'Insurance', 'Debt', 'Subscriptions', 'Family']

export default function MonthlyPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [bills, setBills] = useState<BillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [showUnpaid, setShowUnpaid] = useState(false)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editPaid, setEditPaid] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchBills = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finances/actuals?year=${year}&month=${month}`)
    const json = await res.json()
    setBills(json.data ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchBills() }, [fetchBills])

  function openSheet(bill: BillRow) {
    setSelectedBill(bill)
    setEditAmount(String(bill.actual_amount ?? bill.default_amount ?? ''))
    setEditPaid(bill.is_paid ?? false)
    setEditDate(bill.paid_date ? bill.paid_date.split('T')[0] : new Date().toISOString().split('T')[0])
    setSheetOpen(true)
  }

  async function saveActual() {
    if (!selectedBill) return
    setSaving(true)
    await fetch('/api/finances/actuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bill_id: selectedBill.bill_id,
        year,
        month,
        amount: editAmount ? parseFloat(editAmount) : null,
        is_paid: editPaid,
        paid_date: editPaid ? editDate : null,
      }),
    })
    setSaving(false)
    setSheetOpen(false)
    fetchBills()
  }

  async function togglePaid(bill: BillRow) {
    const newPaid = !bill.is_paid
    await fetch('/api/finances/actuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bill_id: bill.bill_id,
        year,
        month,
        amount: bill.actual_amount ?? bill.default_amount,
        is_paid: newPaid,
        paid_date: newPaid ? new Date().toISOString().split('T')[0] : null,
      }),
    })
    fetchBills()
  }

  const filtered = bills.filter(b => {
    if (filter !== 'All' && b.category !== filter) return false
    if (showUnpaid && b.is_paid) return false
    return true
  })

  const total = bills.reduce((s, b) => s + parseFloat(String(b.actual_amount ?? b.default_amount ?? 0)), 0)
  const paid = bills.filter(b => b.is_paid).reduce((s, b) => s + parseFloat(String(b.actual_amount ?? b.default_amount ?? 0)), 0)
  const paidPct = total > 0 ? (paid / total) * 100 : 0
  const unpaidCount = bills.filter(b => !b.is_paid).length

  return (
    <FinanceLayout title="Monthly Bills">
      {/* Month selector */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none"
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex-1 overflow-x-auto flex gap-1.5 py-0.5">
          {MONTHS.map(m => (
            <button
              key={m}
              onClick={() => setMonth(m)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={month === m
                ? { backgroundColor: '#1B2A4A', color: '#fff' }
                : { backgroundColor: '#E5E7EB', color: '#374151' }}
            >
              {shortMonthName(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(paid)}</span>
            <span className="text-sm text-gray-400 ml-1">/ {formatCurrency(total)}</span>
          </div>
          <span className="text-sm font-medium text-gray-500">{paidPct.toFixed(0)}%</span>
        </div>
        <ProgressBar value={paidPct} />
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>{bills.filter(b => b.is_paid).length} paid</span>
          <span>{unpaidCount} remaining</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
            style={filter === cat
              ? { backgroundColor: '#2DB5AD', color: '#fff', borderColor: '#2DB5AD' }
              : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setShowUnpaid(!showUnpaid)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
          style={showUnpaid
            ? { backgroundColor: '#F0A500', color: '#fff', borderColor: '#F0A500' }
            : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
        >
          Unpaid only
        </button>
      </div>

      {/* Bill list */}
      {loading ? <LoadingSkeleton rows={5} /> : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No bills found</div>
          )}
          {filtered.map(bill => {
            const amount = bill.actual_amount ?? bill.default_amount
            return (
              <div
                key={bill.bill_id}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.99] transition-transform"
              >
                {/* Paid toggle */}
                <button
                  onClick={() => togglePaid(bill)}
                  className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                  style={bill.is_paid
                    ? { backgroundColor: '#27AE60', borderColor: '#27AE60' }
                    : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}
                >
                  {bill.is_paid && <span className="text-white text-xs">✓</span>}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0" onClick={() => openSheet(bill)}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-semibold ${bill.is_paid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {bill.name}
                    </span>
                    <CategoryChip category={bill.category} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {bill.due_day && <span>Due {bill.due_day}</span>}
                    {bill.account && <span>{bill.account}</span>}
                    {bill.billing_type !== 'Fixed' && <span className="italic">{bill.billing_type}</span>}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0" onClick={() => openSheet(bill)}>
                  <p className={`text-base font-bold ${bill.is_paid ? 'text-gray-400' : 'text-gray-900'}`}>
                    {amount !== null ? formatCurrency(amount) : <span className="text-gray-300">—</span>}
                  </p>
                  {bill.actual_amount && bill.default_amount && bill.actual_amount !== bill.default_amount && (
                    <p className="text-xs text-gray-400 line-through">{formatCurrency(bill.default_amount)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={selectedBill?.name ?? ''}
      >
        {selectedBill && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CategoryChip category={selectedBill.category} />
              <span className="text-sm text-gray-500">{selectedBill.billing_type}</span>
            </div>

            <AmountInput
              label="Amount"
              value={editAmount}
              onChange={setEditAmount}
              placeholder={String(selectedBill.default_amount ?? '0.00')}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditPaid(!editPaid)}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
                style={editPaid
                  ? { backgroundColor: '#27AE60', borderColor: '#27AE60' }
                  : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}
              >
                {editPaid && <span className="text-white text-xs">✓</span>}
              </button>
              <span className="text-sm text-gray-700">Mark as paid</span>
            </div>

            {editPaid && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date paid</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none"
                />
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveActual}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
                style={{ backgroundColor: '#1B2A4A' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </FinanceLayout>
  )
}
