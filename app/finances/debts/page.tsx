'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import ProgressBar from '@/components/finances/ProgressBar'
import AlertBadge from '@/components/finances/AlertBadge'
import AmountInput from '@/components/finances/AmountInput'
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

const EMPTY_FORM = { name: '', balance: '', apr: '', minPayment: '', promoEndDate: '', hasPromo: false }

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
  const [editForm, setEditForm] = useState({ balance: '', apr: '', minPayment: '', promoEndDate: '', hasPromo: false })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Add sheet
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)

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
    const apr = parseFloat(String(debt.apr))
    const hasPromo = apr === 0 && !!debt.promo_end_date
    setEditForm({
      balance: String(debt.current_balance),
      apr: hasPromo ? '' : String(apr * 100),
      minPayment: String(debt.min_payment ?? ''),
      promoEndDate: debt.promo_end_date ? debt.promo_end_date.split('T')[0] : '',
      hasPromo,
    })
    setConfirmDelete(false)
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
        current_balance: parseFloat(editForm.balance),
        apr: editForm.hasPromo ? 0 : parseFloat(editForm.apr) / 100,
        min_payment: parseFloat(editForm.minPayment),
        promo_end_date: editForm.hasPromo && editForm.promoEndDate ? editForm.promoEndDate : null,
        promo_apr: editForm.hasPromo ? 0.2674 : null,
      }),
    })
    setSaving(false)
    setEditOpen(false)
    fetchDebts()
  }

  async function submitAdd() {
    if (!addForm.name || !addForm.balance) return
    setSaving(true)
    await fetch('/api/finances/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addForm.name,
        current_balance: parseFloat(addForm.balance),
        original_balance: parseFloat(addForm.balance),
        apr: addForm.hasPromo ? 0 : (parseFloat(addForm.apr) || 0) / 100,
        min_payment: parseFloat(addForm.minPayment) || 0,
        promo_end_date: addForm.hasPromo && addForm.promoEndDate ? addForm.promoEndDate : null,
        promo_apr: addForm.hasPromo ? 0 : null,
      }),
    })
    setSaving(false)
    setAddOpen(false)
    setAddForm(EMPTY_FORM)
    fetchDebts()
  }

  async function deleteDebt() {
    if (!selected) return
    setDeleting(true)
    await fetch(`/api/finances/debts/${selected.id}`, { method: 'DELETE' })
    setDeleting(false)
    setEditOpen(false)
    setConfirmDelete(false)
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
                    className="ml-2 text-xs text-gray-400 px-2 py-1 rounded-lg bg-gray-50 active:bg-gray-100"
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

                {/* Balance + APR + Min */}
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

          {/* Add new debt button */}
          <button
            onClick={() => { setAddForm(EMPTY_FORM); setAddOpen(true) }}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold border-2 border-dashed border-gray-200 text-gray-400 active:bg-gray-50"
          >
            + Add New Debt
          </button>
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
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
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

      {/* Edit Sheet */}
      <BottomSheet open={editOpen} onClose={() => { setEditOpen(false); setConfirmDelete(false) }} title={`Edit: ${selected?.name}`}>
        {selected && (
          <div className="space-y-4">
            <AmountInput label="Current Balance" value={editForm.balance} onChange={v => setEditForm(f => ({ ...f, balance: v }))} />
            <AmountInput label="Min Payment" value={editForm.minPayment} onChange={v => setEditForm(f => ({ ...f, minPayment: v }))} />

            {/* Promo toggle */}
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-medium text-gray-700">0% Promotional Rate</label>
              <button
                onClick={() => setEditForm(f => ({ ...f, hasPromo: !f.hasPromo, apr: '' }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${editForm.hasPromo ? 'bg-teal-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.hasPromo ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {editForm.hasPromo ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Promo End Date</label>
                <input type="date" value={editForm.promoEndDate} onChange={e => setEditForm(f => ({ ...f, promoEndDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">APR (%)</label>
                <input type="number" step="0.01" value={editForm.apr} onChange={e => setEditForm(f => ({ ...f, apr: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" placeholder="e.g. 4.99" />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setEditOpen(false); setConfirmDelete(false) }} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
              <button onClick={submitEdit} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#1B2A4A' }}>
                {saving ? 'Saving…' : 'Update'}
              </button>
            </div>

            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-xl text-red-500 text-sm font-medium border border-red-100 bg-red-50 active:bg-red-100">
                Remove this debt
              </button>
            ) : (
              <div className="bg-red-50 rounded-xl p-3 space-y-2">
                <p className="text-sm font-medium text-red-700 text-center">Remove "{selected.name}"?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold">Keep it</button>
                  <button onClick={deleteDebt} disabled={deleting} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 bg-red-500">
                    {deleting ? 'Removing…' : 'Yes, remove'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Add New Debt Sheet */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add New Debt">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Chase Credit Card"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
          </div>

          <AmountInput label="Current Balance" value={addForm.balance} onChange={v => setAddForm(f => ({ ...f, balance: v }))} required />
          <AmountInput label="Min Payment" value={addForm.minPayment} onChange={v => setAddForm(f => ({ ...f, minPayment: v }))} />

          {/* Promo toggle */}
          <div className="flex items-center justify-between px-1">
            <label className="text-sm font-medium text-gray-700">0% Promotional Rate</label>
            <button
              onClick={() => setAddForm(f => ({ ...f, hasPromo: !f.hasPromo, apr: '' }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${addForm.hasPromo ? 'bg-teal-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${addForm.hasPromo ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {addForm.hasPromo ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promo End Date</label>
              <input type="date" value={addForm.promoEndDate} onChange={e => setAddForm(f => ({ ...f, promoEndDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">APR (%)</label>
              <input type="number" step="0.01" value={addForm.apr} onChange={e => setAddForm(f => ({ ...f, apr: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" placeholder="e.g. 24.99" />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
            <button onClick={submitAdd} disabled={saving || !addForm.name || !addForm.balance}
              className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#1B2A4A' }}>
              {saving ? 'Adding…' : 'Add Debt'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </FinanceLayout>
  )
}
