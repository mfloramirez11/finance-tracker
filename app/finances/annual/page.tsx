'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import AlertBadge from '@/components/finances/AlertBadge'
import CategoryChip, { CATEGORY_COLORS } from '@/components/finances/CategoryChip'
import AmountInput from '@/components/finances/AmountInput'
import ProgressBar from '@/components/finances/ProgressBar'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, formatDate, daysUntil } from '@/lib/finances/format'

const CATEGORIES = ['Auto', 'Credit Card', 'Health', 'Housing', 'Insurance', 'Subscriptions', 'Tech', 'Other']
const FILTER_CATS = ['All', ...CATEGORIES]

interface Account {
  id: string
  name: string
  type: string
}

interface AnnualItem {
  id: string
  name: string
  category: string
  amount: number
  due_date: string
  account: string | null
  is_paid: boolean
  paid_date: string | null
  notes: string | null
}

interface AnnualData {
  items: AnnualItem[]
  total: number
  paid: number
  remaining: number
}

const EMPTY_EDIT = { name: '', category: 'Auto', amount: '', dueDate: '', account: '', isPaid: false, paidDate: '' }

export default function AnnualPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<AnnualData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [filterCat, setFilterCat] = useState('All')
  const [accounts, setAccounts] = useState<Account[]>([])

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<AnnualItem | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add sheet
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_EDIT)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finances/annual?year=${year}`)
    const json = await res.json()
    setData(json.data)
    setLoading(false)
  }, [year])

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/finances/accounts')
    if (!res.ok) return
    const json = await res.json()
    setAccounts(json.data ?? [])
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  function openEdit(item: AnnualItem) {
    setSelected(item)
    setEditForm({
      name: item.name,
      category: item.category,
      amount: String(item.amount),
      dueDate: item.due_date.split('T')[0],
      account: item.account ?? '',
      isPaid: item.is_paid,
      paidDate: item.paid_date ? item.paid_date.split('T')[0] : new Date().toISOString().split('T')[0],
    })
    setConfirmDelete(false)
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/finances/annual/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        category: editForm.category,
        amount: parseFloat(editForm.amount) || selected.amount,
        due_date: editForm.dueDate,
        account: editForm.account || null,
        is_paid: editForm.isPaid,
        paid_date: editForm.isPaid ? editForm.paidDate : null,
      }),
    })
    setSaving(false)
    setEditOpen(false)
    fetchData()
  }

  async function deleteItem() {
    if (!selected) return
    setDeleting(true)
    await fetch(`/api/finances/annual/${selected.id}`, { method: 'DELETE' })
    setDeleting(false)
    setEditOpen(false)
    setConfirmDelete(false)
    fetchData()
  }

  async function saveAdd() {
    if (!addForm.name || !addForm.amount || !addForm.dueDate) return
    setSaving(true)
    await fetch('/api/finances/annual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addForm.name,
        category: addForm.category,
        amount: parseFloat(addForm.amount),
        due_date: addForm.dueDate,
        account: addForm.account || null,
        year,
        is_critical: false,
      }),
    })
    setSaving(false)
    setAddOpen(false)
    setAddForm(EMPTY_EDIT)
    fetchData()
  }

  const filtered = (data?.items ?? []).filter(item => {
    if (filterCat !== 'All' && item.category !== filterCat) return false
    if (filterPaid === 'paid') return item.is_paid
    if (filterPaid === 'unpaid') return !item.is_paid
    return true
  })

  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const creditCards = accounts.filter(a => a.type === 'credit_card')

  const statItems = filterCat === 'All' ? (data?.items ?? []) : (data?.items ?? []).filter(i => i.category === filterCat)
  const displayTotal = statItems.reduce((s, i) => s + parseFloat(String(i.amount)), 0)
  const displayPaid = statItems.filter(i => i.is_paid).reduce((s, i) => s + parseFloat(String(i.amount)), 0)
  const paidPct = displayTotal > 0 ? (displayPaid / displayTotal) * 100 : 0
  const activeCatColor = filterCat !== 'All' ? (CATEGORY_COLORS[filterCat]?.bg ?? '#2DB5AD') : undefined

  const formFields = (form: typeof EMPTY_EDIT, setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_EDIT>>) => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
          placeholder="e.g. Toyota Registration"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <AmountInput label="Amount" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} required />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
        <input
          type="date"
          value={form.dueDate}
          onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account / Card</label>
        <select
          value={form.account}
          onChange={e => setForm(f => ({ ...f, account: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white"
        >
          <option value="">— None —</option>
          {bankAccounts.length > 0 && (
            <optgroup label="Bank Accounts">
              {bankAccounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </optgroup>
          )}
          {creditCards.length > 0 && (
            <optgroup label="Credit Cards">
              {creditCards.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
    </>
  )

  return (
    <FinanceLayout
      title="Annual Expenses"
      rightAction={
        <button
          onClick={() => { setAddForm(EMPTY_EDIT); setAddOpen(true) }}
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
              <p className="text-base font-bold text-gray-900">{formatCurrency(displayTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Paid</p>
              <p className="text-base font-bold" style={{ color: '#27AE60' }}>{formatCurrency(displayPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Remaining</p>
              <p className="text-base font-bold" style={{ color: '#D94F3D' }}>{formatCurrency(displayTotal - displayPaid)}</p>
            </div>
          </div>
          <ProgressBar value={paidPct} color={activeCatColor} />
        </div>
      )}

      {/* Category filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {FILTER_CATS.map(cat => {
          const catColor = cat === 'All' ? '#2DB5AD' : (CATEGORY_COLORS[cat]?.bg ?? '#2DB5AD')
          return (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={filterCat === cat
                ? { backgroundColor: catColor, color: '#fff', borderColor: catColor }
                : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Paid/unpaid filter tabs */}
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
      <BottomSheet open={editOpen} onClose={() => { setEditOpen(false); setConfirmDelete(false) }} title="Edit Expense">
        {selected && (
          <div className="space-y-4">
            {formFields(editForm, setEditForm)}

            {/* Paid toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditForm(f => ({ ...f, isPaid: !f.isPaid }))}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                style={editForm.isPaid
                  ? { backgroundColor: '#27AE60', borderColor: '#27AE60' }
                  : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}
              >
                {editForm.isPaid && <span className="text-white text-xs">✓</span>}
              </button>
              <span className="text-sm text-gray-700">Mark as paid</span>
            </div>

            {editForm.isPaid && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date paid</label>
                <input
                  type="date"
                  value={editForm.paidDate}
                  onChange={e => setEditForm(f => ({ ...f, paidDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setEditOpen(false); setConfirmDelete(false) }} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#1B2A4A' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-xl text-red-500 text-sm font-medium border border-red-100 bg-red-50 active:bg-red-100">
                Delete this expense
              </button>
            ) : (
              <div className="bg-red-50 rounded-xl p-3 space-y-2">
                <p className="text-sm font-medium text-red-700 text-center">Delete "{selected.name}"?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold">Keep it</button>
                  <button onClick={deleteItem} disabled={deleting} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 bg-red-500">
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Add Sheet */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Annual Expense">
        <div className="space-y-4">
          {formFields(addForm, setAddForm)}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
            <button onClick={saveAdd} disabled={saving || !addForm.name || !addForm.amount || !addForm.dueDate}
              className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#2DB5AD' }}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </FinanceLayout>
  )
}
