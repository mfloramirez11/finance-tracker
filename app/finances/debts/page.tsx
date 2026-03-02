'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import ProgressBar from '@/components/finances/ProgressBar'
import AlertBadge from '@/components/finances/AlertBadge'
import AmountInput from '@/components/finances/AmountInput'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, formatDate, daysUntil } from '@/lib/finances/format'

interface Payment {
  id: string
  debt_id: string
  payment_date: string
  amount: number
  principal_amount: number | null
  interest_amount: number | null
  late_fees: number | null
  misc_fees: number | null
  notes: string | null
  created_at: string
}

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

const EMPTY_FORM = { name: '', account: '', balance: '', apr: '', minPayment: '', promoEndDate: '', hasPromo: false }

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [totalDebt, setTotalDebt] = useState(0)
  const [totalMin, setTotalMin] = useState(0)

  // Payment sheet
  const [paySheetOpen, setPaySheetOpen] = useState(false)
  const [selected, setSelected] = useState<Debt | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payPrincipal, setPayPrincipal] = useState('')
  const [payInterest, setPayInterest] = useState('')
  const [payLateFees, setPayLateFees] = useState('')
  const [payMiscFees, setPayMiscFees] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', account: '', balance: '', originalBalance: '', apr: '', minPayment: '', promoEndDate: '', hasPromo: false })
  const [sortBy, setSortBy] = useState<'name' | 'account' | 'payoff'>('name')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Add sheet
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)

  // History sheet
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyDebt, setHistoryDebt] = useState<Debt | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [editPayAmount, setEditPayAmount] = useState('')
  const [editPayPrincipal, setEditPayPrincipal] = useState('')
  const [editPayInterest, setEditPayInterest] = useState('')
  const [editPayLateFees, setEditPayLateFees] = useState('')
  const [editPayMiscFees, setEditPayMiscFees] = useState('')
  const [editPayDate, setEditPayDate] = useState('')
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)

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
    const isZero = parseFloat(String(debt.apr)) === 0
    if (isZero) {
      setPayAmount(String(debt.min_payment ?? ''))
    } else {
      setPayAmount('')
      setPayPrincipal('')
      setPayInterest('')
      setPayLateFees('')
      setPayMiscFees('')
    }
    setPayDate(new Date().toISOString().split('T')[0])
    setPaySheetOpen(true)
  }

  function openEdit(debt: Debt) {
    setSelected(debt)
    const apr = parseFloat(String(debt.apr))
    const hasPromo = apr === 0 && !!debt.promo_end_date
    setEditForm({
      name: debt.name,
      account: debt.account ?? '',
      balance: String(debt.current_balance),
      originalBalance: String(debt.original_balance ?? debt.current_balance),
      apr: hasPromo ? '' : String(parseFloat((apr * 100).toFixed(10))),
      minPayment: String(debt.min_payment ?? ''),
      promoEndDate: debt.promo_end_date ? debt.promo_end_date.split('T')[0] : '',
      hasPromo,
    })
    setConfirmDelete(false)
    setEditOpen(true)
  }

  async function submitPayment() {
    if (!selected) return
    const isZero = parseFloat(String(selected.apr)) === 0
    setSaving(true)

    if (isZero) {
      if (!payAmount) { setSaving(false); return }
      await fetch(`/api/finances/debts/${selected.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(payAmount), payment_date: payDate }),
      })
    } else {
      const principal = parseFloat(payPrincipal) || 0
      const interest = parseFloat(payInterest) || 0
      const lateFees = parseFloat(payLateFees) || 0
      const miscFees = parseFloat(payMiscFees) || 0
      const total = principal + interest + lateFees + miscFees
      if (!total) { setSaving(false); return }
      await fetch(`/api/finances/debts/${selected.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: total,
          principal_amount: principal || null,
          interest_amount: interest || null,
          late_fees: lateFees || null,
          misc_fees: miscFees || null,
          payment_date: payDate,
        }),
      })
    }

    setSaving(false)
    setPaySheetOpen(false)
    fetchDebts()
  }

  async function submitEdit() {
    if (!selected) return
    setSaving(true)
    const newBalance = parseFloat(editForm.balance)
    const originalBalance = parseFloat(editForm.originalBalance) || newBalance
    await fetch(`/api/finances/debts/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        account: editForm.account || null,
        current_balance: newBalance,
        original_balance: originalBalance,
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
        account: addForm.account || null,
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

  async function recalculateBalance() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/finances/debts/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recalculate_from_history: true }),
    })
    const json = await res.json()
    if (json.data) {
      setEditForm(f => ({ ...f, balance: String(parseFloat(String(json.data.current_balance))) }))
    }
    setSaving(false)
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

  async function openHistory(debt: Debt) {
    setHistoryDebt(debt)
    setEditingPayment(null)
    setConfirmDeletePaymentId(null)
    setHistoryOpen(true)
    setPaymentsLoading(true)
    const res = await fetch(`/api/finances/debts/${debt.id}/payment`)
    const json = await res.json()
    setPayments(json.data ?? [])
    setPaymentsLoading(false)
  }

  function startEditPayment(payment: Payment) {
    setEditingPayment(payment)
    setConfirmDeletePaymentId(null)
    setEditPayAmount(String(payment.amount))
    setEditPayPrincipal(payment.principal_amount != null ? String(payment.principal_amount) : '')
    setEditPayInterest(payment.interest_amount != null ? String(payment.interest_amount) : '')
    setEditPayLateFees(payment.late_fees != null ? String(payment.late_fees) : '')
    setEditPayMiscFees(payment.misc_fees != null ? String(payment.misc_fees) : '')
    setEditPayDate(payment.payment_date.split('T')[0])
  }

  async function submitEditPayment() {
    if (!editingPayment || !historyDebt) return
    setSaving(true)
    const isZero = parseFloat(String(historyDebt.apr)) === 0
    let body: object
    if (isZero) {
      body = { amount: parseFloat(editPayAmount) || 0, payment_date: editPayDate }
    } else {
      const principal = parseFloat(editPayPrincipal) || 0
      const interest = parseFloat(editPayInterest) || 0
      const lateFees = parseFloat(editPayLateFees) || 0
      const miscFees = parseFloat(editPayMiscFees) || 0
      body = {
        amount: principal + interest + lateFees + miscFees,
        principal_amount: principal || null,
        interest_amount: interest || null,
        late_fees: lateFees || null,
        misc_fees: miscFees || null,
        payment_date: editPayDate,
      }
    }
    await fetch(`/api/finances/debts/${historyDebt.id}/payment/${editingPayment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setEditingPayment(null)
    const res = await fetch(`/api/finances/debts/${historyDebt.id}/payment`)
    const json = await res.json()
    setPayments(json.data ?? [])
    fetchDebts()
  }

  async function deletePayment(paymentId: string) {
    if (!historyDebt) return
    setDeletingPaymentId(paymentId)
    await fetch(`/api/finances/debts/${historyDebt.id}/payment/${paymentId}`, { method: 'DELETE' })
    setDeletingPaymentId(null)
    setConfirmDeletePaymentId(null)
    const res = await fetch(`/api/finances/debts/${historyDebt.id}/payment`)
    const json = await res.json()
    setPayments(json.data ?? [])
    fetchDebts()
  }

  const sortedDebts = [...debts].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'account') return (a.account ?? '').localeCompare(b.account ?? '')
    if (sortBy === 'payoff') {
      const origA = parseFloat(String(a.original_balance)) || parseFloat(String(a.current_balance))
      const origB = parseFloat(String(b.original_balance)) || parseFloat(String(b.current_balance))
      const pctA = origA > 0 ? (origA - parseFloat(String(a.current_balance))) / origA : 0
      const pctB = origB > 0 ? (origB - parseFloat(String(b.current_balance))) / origB : 0
      return pctB - pctA
    }
    return 0
  })

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

          {/* Sort controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs shrink-0" style={{ color: 'var(--text-3)' }}>Sort by</span>
            {(['name', 'account', 'payoff'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                style={sortBy === s
                  ? { backgroundColor: 'var(--color-navy)', color: '#fff', borderColor: 'var(--color-navy)' }
                  : { backgroundColor: 'var(--card)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                {s === 'name' ? 'Name' : s === 'account' ? 'Company' : 'Payoff %'}
              </button>
            ))}
          </div>

          {/* Debt cards */}
          {sortedDebts.map(debt => {
            const original = parseFloat(String(debt.original_balance)) || parseFloat(String(debt.current_balance))
            const current = parseFloat(String(debt.current_balance))
            const paidPct = original > 0 ? Math.max(0, ((original - current) / original) * 100) : 0
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
                <button
                  onClick={() => openHistory(debt)}
                  className="w-full py-2 text-xs font-medium text-gray-400 mt-1 active:text-gray-600"
                >
                  View payment history
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
        {selected && (() => {
          const isZero = parseFloat(String(selected.apr)) === 0
          const breakdownTotal = (parseFloat(payPrincipal) || 0) + (parseFloat(payInterest) || 0) + (parseFloat(payLateFees) || 0) + (parseFloat(payMiscFees) || 0)
          const canSubmit = isZero ? !!payAmount : breakdownTotal > 0

          return (
            <div className="space-y-4">
              {/* Current balance pill */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <p className="text-xs text-gray-400">Current Balance</p>
                <p className="text-lg font-bold" style={{ color: '#D94F3D' }}>{formatCurrency(selected.current_balance)}</p>
              </div>

              {isZero ? (
                /* 0% APR — simple amount, full payment reduces balance */
                <AmountInput label="Payment Amount" value={payAmount} onChange={setPayAmount} required />
              ) : (
                /* Has interest — breakdown form */
                <>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transaction Details</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center px-4 py-3 gap-3">
                        <span className="text-sm text-gray-700 w-32 shrink-0">Principal</span>
                        <AmountInput value={payPrincipal} onChange={setPayPrincipal} placeholder="0.00" compact />
                      </div>
                      <div className="flex items-center px-4 py-3 gap-3">
                        <span className="text-sm text-gray-700 w-32 shrink-0">Interest</span>
                        <AmountInput value={payInterest} onChange={setPayInterest} placeholder="0.00" compact />
                      </div>
                      <div className="flex items-center px-4 py-3 gap-3">
                        <span className="text-sm text-gray-700 w-32 shrink-0">Late Fees</span>
                        <AmountInput value={payLateFees} onChange={setPayLateFees} placeholder="0.00" compact />
                      </div>
                      <div className="flex items-center px-4 py-3 gap-3">
                        <span className="text-sm text-gray-700 w-32 shrink-0">Misc. Fees</span>
                        <AmountInput value={payMiscFees} onChange={setPayMiscFees} placeholder="0.00" compact />
                      </div>
                    </div>
                    {breakdownTotal > 0 && (
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                        <span className="text-sm font-bold text-gray-800">Total Amount</span>
                        <span className="text-base font-bold text-gray-900">{formatCurrency(breakdownTotal)}</span>
                      </div>
                    )}
                  </div>
                  {breakdownTotal > 0 && (
                    <p className="text-xs text-gray-400 text-center">
                      Balance will decrease by <span className="font-semibold text-gray-600">{formatCurrency(breakdownTotal)}</span>
                    </p>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setPaySheetOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
                <button onClick={submitPayment} disabled={saving || !canSubmit} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#2DB5AD' }}>
                  {saving ? 'Saving…' : 'Log Payment'}
                </button>
              </div>
            </div>
          )
        })()}
      </BottomSheet>

      {/* Edit Sheet */}
      <BottomSheet open={editOpen} onClose={() => { setEditOpen(false); setConfirmDelete(false) }} title={`Edit: ${selected?.name}`}>
        {selected && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company / Bank</label>
              <input type="text" value={editForm.account} onChange={e => setEditForm(f => ({ ...f, account: e.target.value }))}
                placeholder="e.g. Chase, Aidvantage, Bank of America"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
            </div>
            <AmountInput label="Current Balance" value={editForm.balance} onChange={v => setEditForm(f => ({ ...f, balance: v }))} />
            <AmountInput label="Original / Starting Balance" value={editForm.originalBalance} onChange={v => setEditForm(f => ({ ...f, originalBalance: v }))} />
            <AmountInput label="Min Payment" value={editForm.minPayment} onChange={v => setEditForm(f => ({ ...f, minPayment: v }))} />

            {/* Recalculate balance */}
            <button
              onClick={recalculateBalance}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--color-teal)', color: 'var(--color-teal)', backgroundColor: 'transparent' }}
            >
              ↻ Recalculate Balance from Payment History
            </button>
            <p className="text-xs -mt-2" style={{ color: 'var(--text-3)' }}>
              For interest-bearing loans: sets balance to original balance minus all principal payments logged.
            </p>

            {/* Promo toggle */}
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>0% Promotional Rate</label>
              <button
                onClick={() => setEditForm(f => ({ ...f, hasPromo: !f.hasPromo, apr: '' }))}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ backgroundColor: editForm.hasPromo ? 'var(--color-teal)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                  style={{ transform: editForm.hasPromo ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
                />
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company / Bank</label>
            <input type="text" value={addForm.account} onChange={e => setAddForm(f => ({ ...f, account: e.target.value }))}
              placeholder="e.g. Chase, Aidvantage, Bank of America"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
          </div>

          <AmountInput label="Current Balance" value={addForm.balance} onChange={v => setAddForm(f => ({ ...f, balance: v }))} required />
          <AmountInput label="Min Payment" value={addForm.minPayment} onChange={v => setAddForm(f => ({ ...f, minPayment: v }))} />

          {/* Promo toggle */}
          <div className="flex items-center justify-between px-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>0% Promotional Rate</label>
            <button
              onClick={() => setAddForm(f => ({ ...f, hasPromo: !f.hasPromo, apr: '' }))}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ backgroundColor: addForm.hasPromo ? 'var(--color-teal)' : 'var(--border)' }}
            >
              <span
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: addForm.hasPromo ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
              />
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

      {/* Payment History Sheet */}
      <BottomSheet open={historyOpen} onClose={() => { setHistoryOpen(false); setEditingPayment(null) }} title={editingPayment ? 'Edit Payment' : `History: ${historyDebt?.name}`}>
        {editingPayment ? (
          /* ── Edit a specific payment ── */
          <div className="space-y-4">
            {/* Back button */}
            <button
              onClick={() => setEditingPayment(null)}
              className="flex items-center gap-1.5 text-sm text-gray-500 active:text-gray-700 -mt-1"
            >
              ← Back to history
            </button>

            {historyDebt && (() => {
              const isZero = parseFloat(String(historyDebt.apr)) === 0
              const editBreakdownTotal =
                (parseFloat(editPayPrincipal) || 0) +
                (parseFloat(editPayInterest) || 0) +
                (parseFloat(editPayLateFees) || 0) +
                (parseFloat(editPayMiscFees) || 0)
              const canSave = isZero
                ? !!(parseFloat(editPayAmount) > 0)
                : editBreakdownTotal > 0

              return (
                <>
                  {isZero ? (
                    <AmountInput label="Payment Amount" value={editPayAmount} onChange={setEditPayAmount} required />
                  ) : (
                    <>
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transaction Details</p>
                        </div>
                        <div className="divide-y divide-gray-100">
                          <div className="flex items-center px-4 py-3 gap-3">
                            <span className="text-sm text-gray-700 w-32 shrink-0">Principal</span>
                            <AmountInput value={editPayPrincipal} onChange={setEditPayPrincipal} placeholder="0.00" compact />
                          </div>
                          <div className="flex items-center px-4 py-3 gap-3">
                            <span className="text-sm text-gray-700 w-32 shrink-0">Interest</span>
                            <AmountInput value={editPayInterest} onChange={setEditPayInterest} placeholder="0.00" compact />
                          </div>
                          <div className="flex items-center px-4 py-3 gap-3">
                            <span className="text-sm text-gray-700 w-32 shrink-0">Late Fees</span>
                            <AmountInput value={editPayLateFees} onChange={setEditPayLateFees} placeholder="0.00" compact />
                          </div>
                          <div className="flex items-center px-4 py-3 gap-3">
                            <span className="text-sm text-gray-700 w-32 shrink-0">Misc. Fees</span>
                            <AmountInput value={editPayMiscFees} onChange={setEditPayMiscFees} placeholder="0.00" compact />
                          </div>
                        </div>
                        {editBreakdownTotal > 0 && (
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                            <span className="text-sm font-bold text-gray-800">Total Amount</span>
                            <span className="text-base font-bold text-gray-900">{formatCurrency(editBreakdownTotal)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                    <input type="date" value={editPayDate} onChange={e => setEditPayDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900" />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setEditingPayment(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
                    <button onClick={submitEditPayment} disabled={saving || !canSave}
                      className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#2DB5AD' }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          /* ── Payment list ── */
          <div className="space-y-2">
            {paymentsLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
            ) : payments.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No payments recorded yet.</div>
            ) : (
              payments.map(p => {
                const hasBreakdown = p.principal_amount != null || p.interest_amount != null || p.late_fees != null || p.misc_fees != null
                const parts: string[] = []
                if (p.principal_amount != null) parts.push(`Principal ${formatCurrency(p.principal_amount)}`)
                if (p.interest_amount != null) parts.push(`Interest ${formatCurrency(p.interest_amount)}`)
                if (p.late_fees != null) parts.push(`Fees ${formatCurrency(p.late_fees)}`)
                if (p.misc_fees != null) parts.push(`Misc ${formatCurrency(p.misc_fees)}`)
                const isConfirmingDelete = confirmDeletePaymentId === p.id
                const isDeleting = deletingPaymentId === p.id

                return (
                  <div key={p.id} className="bg-gray-50 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Date + breakdown */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{formatDate(p.payment_date.split('T')[0])}</p>
                        {hasBreakdown && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{parts.join(' · ')}</p>
                        )}
                        {p.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic truncate">{p.notes}</p>
                        )}
                      </div>
                      {/* Amount */}
                      <p className="text-base font-bold text-gray-900 shrink-0">{formatCurrency(p.amount)}</p>
                      {/* Edit / Delete buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEditPayment(p)}
                          className="p-1.5 rounded-lg text-gray-400 active:bg-gray-200 active:text-gray-700"
                          title="Edit payment"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setConfirmDeletePaymentId(isConfirmingDelete ? null : p.id)}
                          className="p-1.5 rounded-lg text-gray-400 active:bg-red-100 active:text-red-500"
                          title="Delete payment"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Inline delete confirm */}
                    {isConfirmingDelete && (
                      <div className="px-4 pb-3 flex items-center gap-2 border-t border-gray-200 pt-2">
                        <p className="text-xs text-red-600 font-medium flex-1">Delete this payment? Balance will be restored.</p>
                        <button
                          onClick={() => setConfirmDeletePaymentId(null)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deletePayment(p.id)}
                          disabled={isDeleting}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white font-semibold disabled:opacity-60"
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </BottomSheet>
    </FinanceLayout>
  )
}
