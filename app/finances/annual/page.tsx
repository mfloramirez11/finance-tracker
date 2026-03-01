'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import AlertBadge from '@/components/finances/AlertBadge'
import CategoryChip from '@/components/finances/CategoryChip'
import AmountInput from '@/components/finances/AmountInput'
import ProgressBar from '@/components/finances/ProgressBar'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, formatDate, daysUntil } from '@/lib/finances/format'

interface AnnualItem {
  id: string
  name: string
  category: string
  amount: number
  due_date: string
  account: string | null
  is_paid: boolean
  paid_date: string | null
  is_critical: boolean
  notes: string | null
}

interface AnnualData {
  items: AnnualItem[]
  total: number
  paid: number
  remaining: number
}

export default function AnnualPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<AnnualData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<AnnualItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Edit form
  const [editAmount, setEditAmount] = useState('')
  const [editPaid, setEditPaid] = useState(false)
  const [editDate, setEditDate] = useState('')

  // Add form
  const [addName, setAddName] = useState('')
  const [addCategory, setAddCategory] = useState('Auto')
  const [addAmount, setAddAmount] = useState('')
  const [addDueDate, setAddDueDate] = useState('')
  const [addAccount, setAddAccount] = useState('')
  const [addCritical, setAddCritical] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finances/annual?year=${year}`)
    const json = await res.json()
    setData(json.data)
    setLoading(false)
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  function openEdit(item: AnnualItem) {
    setSelected(item)
    setEditAmount(String(item.amount))
    setEditPaid(item.is_paid)
    setEditDate(item.paid_date ? item.paid_date.split('T')[0] : new Date().toISOString().split('T')[0])
    setSheetOpen(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/finances/annual/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(editAmount) || selected.amount,
        is_paid: editPaid,
        paid_date: editPaid ? editDate : null,
      }),
    })
    setSaving(false)
    setSheetOpen(false)
    fetchData()
  }

  async function saveAdd() {
    if (!addName || !addAmount || !addDueDate) return
    setSaving(true)
    await fetch('/api/finances/annual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addName, category: addCategory, amount: parseFloat(addAmount),
        due_date: addDueDate, account: addAccount, year, is_critical: addCritical,
      }),
    })
    setSaving(false)
    setAddOpen(false)
    setAddName(''); setAddAmount(''); setAddDueDate(''); setAddAccount('')
    fetchData()
  }

  const filtered = (data?.items ?? []).filter(item => {
    if (filterPaid === 'paid') return item.is_paid
    if (filterPaid === 'unpaid') return !item.is_paid
    return true
  })

  const paidPct = data ? (data.paid / (data.total || 1)) * 100 : 0

  return (
    <FinanceLayout
      title="Annual Expenses"
      rightAction={
        <button
          onClick={() => setAddOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-white text-xl font-bold"
          style={{ backgroundColor: '#2DB5AD' }}
        >
          +
        </button>
      }
    >
      {/* Year selector */}
      <div className="flex gap-2 mb-4">
        {[2025, 2026, 2027].map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={year === y
              ? { backgroundColor: '#1B2A4A', color: '#fff' }
              : { backgroundColor: '#E5E7EB', color: '#374151' }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Summary */}
      {data && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(data.total)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Paid</p>
              <p className="text-base font-bold" style={{ color: '#27AE60' }}>{formatCurrency(data.paid)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Remaining</p>
              <p className="text-base font-bold" style={{ color: '#D94F3D' }}>{formatCurrency(data.remaining)}</p>
            </div>
          </div>
          <ProgressBar value={paidPct} />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterPaid(f)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border capitalize"
            style={filterPaid === f
              ? { backgroundColor: '#2DB5AD', color: '#fff', borderColor: '#2DB5AD' }
              : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Items list */}
      {loading ? <LoadingSkeleton rows={5} /> : (
        <div className="space-y-2">
          {filtered.map(item => {
            const dueDateStr = item.due_date.split('T')[0]
            const days = daysUntil(dueDateStr)
            return (
              <div
                key={item.id}
                onClick={() => openEdit(item)}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3 cursor-pointer active:scale-[0.99] transition-transform"
              >
                {/* Status dot */}
                <div
                  className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={item.is_paid
                    ? { backgroundColor: '#27AE60', borderColor: '#27AE60' }
                    : { borderColor: '#D1D5DB' }}
                >
                  {item.is_paid && <span className="text-white text-xs">✓</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-sm font-semibold ${item.is_paid ? 'text-gray-400' : 'text-gray-900'}`}>
                      {item.name}
                    </span>
                    {item.is_critical && (
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: '#D94F3D' }}>
                        Critical
                      </span>
                    )}
                    <CategoryChip category={item.category} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span>Due {formatDate(dueDateStr)}</span>
                    {item.account && <span>{item.account}</span>}
                    {item.is_paid && item.paid_date && <span className="text-green-600">Paid {formatDate(item.paid_date.split('T')[0])}</span>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className={`text-base font-bold mb-1 ${item.is_paid ? 'text-gray-400' : 'text-gray-900'}`}>
                    {formatCurrency(item.amount)}
                  </p>
                  {!item.is_paid && <AlertBadge days={days} />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={selected?.name ?? ''}>
        {selected && (
          <div className="space-y-4">
            <AmountInput label="Amount" value={editAmount} onChange={setEditAmount} />

            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditPaid(!editPaid)}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setSheetOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#1B2A4A' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Add Sheet */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Annual Expense">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
              placeholder="e.g. Toyota Registration"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={addCategory}
              onChange={e => setAddCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white"
            >
              {['Auto', 'Housing', 'Insurance', 'Subscriptions', 'Tech', 'Health', 'Credit Card', 'Debt', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <AmountInput label="Amount" value={addAmount} onChange={setAddAmount} required />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={addDueDate}
              onChange={e => setAddDueDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <input
              type="text"
              value={addAccount}
              onChange={e => setAddAccount(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
              placeholder="e.g. Chase Manny"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAddCritical(!addCritical)}
              className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
              style={addCritical
                ? { backgroundColor: '#D94F3D', borderColor: '#D94F3D' }
                : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}
            >
              {addCritical && <span className="text-white text-xs">!</span>}
            </button>
            <span className="text-sm text-gray-700">Mark as critical</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
            <button onClick={saveAdd} disabled={saving || !addName || !addAmount || !addDueDate} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#2DB5AD' }}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </FinanceLayout>
  )
}
