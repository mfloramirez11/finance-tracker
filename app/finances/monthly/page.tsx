'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import ProgressBar from '@/components/finances/ProgressBar'
import CategoryChip, { CATEGORY_COLORS } from '@/components/finances/CategoryChip'
import AmountInput from '@/components/finances/AmountInput'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, shortMonthName } from '@/lib/finances/format'

interface BillRow {
  bill_id: string
  name: string
  category: string
  billing_type: string
  default_amount: number | null
  account: string | null
  due_day: string | null
  frequency: string | null
  is_autopay: boolean
  actual_id: string | null
  actual_amount: number | null
  is_paid: boolean
  paid_date: string | null
  actual_notes: string | null
  owner: string | null
  debt_id: string | null
}

interface DebtOption { id: string; name: string }

interface Account {
  id: string
  name: string
  type: string
  paid_by: string | null
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const CAT_OPTIONS = ['Housing', 'Auto', 'Utilities', 'Wireless', 'Insurance', 'Debt', 'Subscriptions', 'Family']
const OWNER_LABELS = ['Manny', 'Celesti', 'Manny & Celesti', 'Family Flores']
const OWNER_COLORS: Record<string, { bg: string; color: string }> = {
  'Manny':           { bg: '#DBEAFE', color: '#1D4ED8' },
  'Celesti':         { bg: '#FCE7F3', color: '#BE185D' },
  'Manny & Celesti': { bg: '#EDE9FE', color: '#7C3AED' },
  'Family Flores':   { bg: '#DCFCE7', color: '#166534' },
}
const BILL_CATS = ['Housing', 'Auto', 'Utilities', 'Wireless', 'Insurance', 'Debt', 'Subscriptions', 'Family']
const FREQUENCIES = ['Monthly', 'Bi-Monthly', 'Bi-Weekly', 'Quarterly', 'Semi-Annual', 'Annual', 'Varies']
const DUE_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))

type SheetView = 'payment' | 'editBill' | 'addBill'

function parseDueDay(d: string | null): number {
  if (!d) return 99
  const match = d.match(/\d+/)
  if (!match) return 99
  const n = parseInt(match[0])
  return n >= 1 && n <= 31 ? n : 99
}

function dueDayOrdinal(d: string | null): string | null {
  const n = parseDueDay(d)
  if (n === 99) return d
  if (n === 11 || n === 12 || n === 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

function parseDueDayToSelectValue(d: string | null): string {
  if (!d) return ''
  const match = d.match(/\d+/)
  if (!match) return 'Varies'
  const n = parseInt(match[0])
  return n >= 1 && n <= 31 ? String(n) : 'Varies'
}

// Suspense wrapper required for useSearchParams in Next.js
export default function MonthlyPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={5} />}>
      <MonthlyPageInner />
    </Suspense>
  )
}

function MonthlyPageInner() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'admin'

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [bills, setBills] = useState<BillRow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [debts, setDebts] = useState<DebtOption[]>([])
  const [loading, setLoading] = useState(true)

  // Filters — initialized from URL params
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [filterCats, setFilterCats] = useState<string[]>(() => searchParams.get('cats')?.split(',').filter(Boolean) ?? [])
  const [ownerFilters, setOwnerFilters] = useState<string[]>(() => searchParams.get('owners')?.split(',').filter(Boolean) ?? [])
  const [showUnpaid, setShowUnpaid] = useState(() => searchParams.get('unpaid') === '1')
  const [sortBy, setSortBy] = useState<'due_date' | 'name' | 'category'>(() => (searchParams.get('sort') as 'due_date' | 'name' | 'category') ?? 'due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc')

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetView, setSheetView] = useState<SheetView>('payment')
  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Payment edit
  const [editAmount, setEditAmount] = useState('')
  const [editPaid, setEditPaid] = useState(false)
  const [editDate, setEditDate] = useState('')

  // Bill definition edit/add
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('Housing')
  const [editBillingType, setEditBillingType] = useState('Fixed')
  const [editAccount, setEditAccount] = useState('')
  const [editDueDay, setEditDueDay] = useState('')
  const [editFrequency, setEditFrequency] = useState('Monthly')
  const [editDefaultAmount, setEditDefaultAmount] = useState('')
  const [editAutopay, setEditAutopay] = useState(false)
  const [editOwner, setEditOwner] = useState('')
  const [editDebtId, setEditDebtId] = useState<string>('')

  // Sync filters to URL (debounced by useEffect)
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (filterCats.length) params.set('cats', filterCats.join(','))
    if (ownerFilters.length) params.set('owners', ownerFilters.join(','))
    if (showUnpaid) params.set('unpaid', '1')
    if (sortBy !== 'due_date') params.set('sort', sortBy)
    if (sortDir !== 'asc') params.set('dir', sortDir)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [search, filterCats, ownerFilters, showUnpaid, sortBy, sortDir, pathname, router])

  const fetchBills = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finances/actuals?year=${year}&month=${month}`)
    const json = await res.json()
    setBills(json.data ?? [])
    setLoading(false)
  }, [year, month])

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/finances/accounts')
    if (!res.ok) return
    const json = await res.json()
    setAccounts(json.data ?? [])
  }, [])

  const fetchDebts = useCallback(async () => {
    const res = await fetch('/api/finances/debts')
    if (!res.ok) return
    const json = await res.json()
    setDebts((json.data?.debts ?? []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })))
  }, [])

  useEffect(() => { fetchBills() }, [fetchBills])
  useEffect(() => { fetchAccounts() }, [fetchAccounts])
  useEffect(() => { fetchDebts() }, [fetchDebts])

  function openPaymentSheet(bill: BillRow) {
    setSelectedBill(bill)
    setEditAmount(String(bill.actual_amount ?? bill.default_amount ?? ''))
    setEditPaid(bill.is_paid ?? false)
    setEditDate(bill.paid_date ? bill.paid_date.split('T')[0] : now.toISOString().split('T')[0])
    setConfirmDelete(false)
    setSheetView('payment')
    setSheetOpen(true)
  }

  function switchToEditBill(bill: BillRow) {
    setSelectedBill(bill)
    setEditName(bill.name)
    setEditCategory(bill.category)
    setEditBillingType(bill.billing_type === 'Fixed' ? 'Fixed' : 'Variable')
    setEditAccount(bill.account ?? '')
    setEditDueDay(parseDueDayToSelectValue(bill.due_day))
    setEditFrequency(bill.frequency ?? 'Monthly')
    setEditDefaultAmount(String(bill.default_amount ?? ''))
    setEditAutopay(bill.is_autopay ?? false)
    setEditOwner(bill.owner ?? '')
    setEditDebtId(bill.debt_id ?? '')
    setConfirmDelete(false)
    setSheetView('editBill')
    if (!sheetOpen) setSheetOpen(true)
  }

  function openAddBillSheet() {
    setSelectedBill(null)
    setEditName('')
    setEditCategory('Housing')
    setEditBillingType('Fixed')
    setEditAccount('')
    setEditDueDay('')
    setEditFrequency('Monthly')
    setEditDefaultAmount('')
    setEditAutopay(false)
    setEditOwner('')
    setEditDebtId('')
    setSheetView('addBill')
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
        year, month,
        amount: editAmount ? parseFloat(editAmount) : null,
        is_paid: editPaid,
        paid_date: editPaid ? editDate : null,
      }),
    })
    setSaving(false)
    setSheetOpen(false)
    fetchBills()
  }

  async function saveBillEdit() {
    if (!selectedBill) return
    setSaving(true)
    const dueDayToSave = editDueDay === 'Varies' ? 'Varies' : editDueDay || null
    await fetch(`/api/finances/bills/${selectedBill.bill_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName,
        category: editCategory,
        billing_type: editBillingType,
        account: editAccount || null,
        due_day: dueDayToSave,
        frequency: editFrequency,
        default_amount: editDefaultAmount ? parseFloat(editDefaultAmount) : null,
        is_autopay: editAutopay,
        owner: editOwner || null,
        debt_id: editDebtId || null,
      }),
    })
    setSaving(false)
    setSheetOpen(false)
    fetchBills()
  }

  async function addBill() {
    if (!editName) return
    setSaving(true)
    const dueDayToSave = editDueDay === 'Varies' ? 'Varies' : editDueDay || null
    await fetch('/api/finances/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName,
        category: editCategory,
        billing_type: editBillingType,
        account: editAccount || null,
        due_day: dueDayToSave,
        frequency: editFrequency,
        default_amount: editDefaultAmount ? parseFloat(editDefaultAmount) : null,
        is_autopay: editAutopay,
        owner: editOwner || null,
      }),
    })
    setSaving(false)
    setSheetOpen(false)
    fetchBills()
  }

  async function deleteBill() {
    if (!selectedBill) return
    setSaving(true)
    await fetch(`/api/finances/bills/${selectedBill.bill_id}`, { method: 'DELETE' })
    setSaving(false)
    setSheetOpen(false)
    fetchBills()
  }

  // Optimistic togglePaid — instant UI update, rolls back on error
  async function togglePaid(bill: BillRow) {
    const newPaid = !bill.is_paid
    setBills(prev => prev.map(b =>
      b.bill_id === bill.bill_id
        ? { ...b, is_paid: newPaid, paid_date: newPaid ? now.toISOString().split('T')[0] : null }
        : b
    ))
    try {
      const res = await fetch('/api/finances/actuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill_id: bill.bill_id,
          year, month,
          amount: bill.actual_amount ?? bill.default_amount,
          is_paid: newPaid,
          paid_date: newPaid ? now.toISOString().split('T')[0] : null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      fetchBills()
    } catch {
      // Roll back optimistic update
      setBills(prev => prev.map(b =>
        b.bill_id === bill.bill_id
          ? { ...b, is_paid: bill.is_paid, paid_date: bill.paid_date }
          : b
      ))
    }
  }

  // Toggle sort: clicking active button reverses direction; clicking new button resets to asc
  function toggleSort(val: 'due_date' | 'name' | 'category') {
    if (sortBy === val) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(val)
      setSortDir('asc')
    }
  }

  // Sort with direction
  const sortedBills = [...bills].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortBy === 'category') {
      const catCmp = a.category.localeCompare(b.category)
      cmp = catCmp !== 0 ? catCmp : parseDueDay(a.due_day) - parseDueDay(b.due_day)
    } else {
      cmp = parseDueDay(a.due_day) - parseDueDay(b.due_day)
    }
    return sortDir === 'desc' ? -cmp : cmp
  })

  const filtered = sortedBills.filter(b => {
    const q = search.toLowerCase()
    if (q && !b.name.toLowerCase().includes(q) && !(b.account ?? '').toLowerCase().includes(q)) return false
    if (ownerFilters.length > 0 && !ownerFilters.includes(b.owner ?? '')) return false
    if (filterCats.length > 0 && !filterCats.includes(b.category)) return false
    if (showUnpaid && b.is_paid) return false
    return true
  })

  const statBills = bills.filter(b => {
    if (ownerFilters.length > 0 && !ownerFilters.includes(b.owner ?? '')) return false
    if (filterCats.length > 0 && !filterCats.includes(b.category)) return false
    return true
  })
  const total = statBills.reduce((s, b) => s + parseFloat(String(b.actual_amount ?? b.default_amount ?? 0)), 0)
  const paid = statBills.filter(b => b.is_paid).reduce((s, b) => s + parseFloat(String(b.actual_amount ?? b.default_amount ?? 0)), 0)
  const paidPct = total > 0 ? (paid / total) * 100 : 0
  const unpaidCount = statBills.filter(b => !b.is_paid).length
  const activeCatColor = filterCats.length === 1 ? (CATEGORY_COLORS[filterCats[0]]?.bg ?? '#2DB5AD') : undefined
  const hasActiveFilters = search !== '' || filterCats.length > 0 || ownerFilters.length > 0 || showUnpaid

  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const creditCards = accounts.filter(a => a.type === 'credit_card')
  const sheetTitle = sheetView === 'addBill' ? 'Add Bill' : sheetView === 'editBill' ? 'Edit Bill' : (selectedBill?.name ?? '')

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const todayDay = now.getDate()
  const comingUp = isCurrentMonth
    ? sortedBills.filter(b => !b.is_paid && parseDueDay(b.due_day) >= todayDay && parseDueDay(b.due_day) <= 31).slice(0, 4)
    : []

  const DUE_DAY_OPTIONS = [
    { value: '', label: '— None —' },
    ...DUE_DAYS.map(d => ({ value: d, label: dueDayOrdinal(d) ?? d })),
    { value: 'Varies', label: 'Varies' },
  ]

  // Group filtered bills by category when sortBy === 'category'
  const groupedFiltered: Array<{ header: string | null; bills: BillRow[] }> = sortBy === 'category'
    ? (() => {
        const groups: Record<string, BillRow[]> = {}
        for (const b of filtered) {
          if (!groups[b.category]) groups[b.category] = []
          groups[b.category].push(b)
        }
        return Object.entries(groups).map(([cat, catBills]) => ({ header: cat, bills: catBills }))
      })()
    : [{ header: null, bills: filtered }]

  return (
    <FinanceLayout
      title="Monthly Bills"
      rightAction={isAdmin ? (
        <button
          onClick={openAddBillSheet}
          className="w-8 h-8 flex items-center justify-center rounded-full text-white text-xl font-bold"
          style={{ backgroundColor: '#2DB5AD' }}
        >+</button>
      ) : undefined}
    >
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
              style={month === m ? { backgroundColor: '#1B2A4A', color: '#fff' } : { backgroundColor: '#E5E7EB', color: '#374151' }}
            >
              {shortMonthName(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(paid)}</span>
            <span className="text-sm text-gray-400 ml-1">/ {formatCurrency(total)}</span>
          </div>
          <span className="text-sm font-medium text-gray-500">{paidPct.toFixed(0)}%</span>
        </div>
        <ProgressBar value={paidPct} color={activeCatColor} />
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>{statBills.filter(b => b.is_paid).length} paid</span>
          <span>{unpaidCount} remaining</span>
        </div>
      </div>

      {/* Coming Up — current month only, hide when category filter active */}
      {!loading && comingUp.length > 0 && filterCats.length === 0 && !showUnpaid && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coming Up</p>
          <div className="space-y-2">
            {comingUp.map(bill => {
              const dayNum = parseDueDay(bill.due_day)
              const daysLeft = dayNum - todayDay
              const amount = bill.actual_amount ?? bill.default_amount
              return (
                <div key={bill.bill_id} className="flex items-center justify-between" onClick={() => openPaymentSheet(bill)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{bill.name}</p>
                    <p className="text-xs text-gray-400">Due {dueDayOrdinal(bill.due_day)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {amount !== null && <span className="text-sm font-semibold text-gray-900">{formatCurrency(amount)}</span>}
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={daysLeft === 0
                        ? { backgroundColor: '#FEE2E2', color: '#D94F3D' }
                        : daysLeft <= 3
                        ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                        : { backgroundColor: '#F0FDF4', color: '#166534' }}
                    >
                      {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search bills…"
          className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
        )}
      </div>

      {/* Owner filters */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        <button
          onClick={() => setOwnerFilters([])}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
          style={ownerFilters.length === 0
            ? { backgroundColor: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }
            : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
        >
          👥 All
        </button>
        {OWNER_LABELS.map(o => {
          const active = ownerFilters.includes(o)
          const col = OWNER_COLORS[o] ?? { bg: '#7C3AED', color: '#fff' }
          return (
            <button
              key={o}
              onClick={() => setOwnerFilters(prev => active ? prev.filter(x => x !== o) : [...prev, o])}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={active
                ? { backgroundColor: col.color, color: '#fff', borderColor: col.color }
                : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
            >
              {o}
            </button>
          )
        })}
      </div>

      {/* Sort row — clicking active button toggles direction */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400 font-medium shrink-0">Sort</span>
        {([['due_date', 'Due Date'], ['name', 'Name'], ['category', 'Label']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => toggleSort(val)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
            style={sortBy === val
              ? { backgroundColor: '#1B2A4A', color: '#fff', borderColor: '#1B2A4A' }
              : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
          >
            {label}{sortBy === val ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>

      {/* Category filters — multi-select */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCats([])}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
          style={filterCats.length === 0
            ? { backgroundColor: '#2DB5AD', color: '#fff', borderColor: '#2DB5AD' }
            : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
        >
          All
        </button>
        {CAT_OPTIONS.map(cat => {
          const active = filterCats.includes(cat)
          const catColor = CATEGORY_COLORS[cat]?.bg ?? '#2DB5AD'
          return (
            <button
              key={cat}
              onClick={() => setFilterCats(prev => active ? prev.filter(x => x !== cat) : [...prev, cat])}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={active
                ? { backgroundColor: catColor, color: '#fff', borderColor: catColor }
                : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
            >
              {cat}
            </button>
          )
        })}
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

      {/* Clear All Filters — only visible when any filter is active */}
      {hasActiveFilters && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => { setSearch(''); setFilterCats([]); setOwnerFilters([]); setShowUnpaid(false) }}
            className="text-xs font-semibold px-3 py-1 rounded-full border"
            style={{ color: '#D94F3D', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}
          >
            ✕ Clear all filters
          </button>
        </div>
      )}

      {/* Bill list — grouped by category when sort=category, flat otherwise */}
      {loading ? <LoadingSkeleton rows={5} /> : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No bills found</div>
          )}
          {groupedFiltered.map(({ header, bills: groupBills }) => (
            <div key={header ?? 'all'}>
              {header && (
                <div className="flex items-center gap-2 px-1 pt-3 pb-1">
                  <CategoryChip category={header} />
                  <span className="text-xs text-gray-400 font-medium">{groupBills.length} bill{groupBills.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="space-y-2">
                {groupBills.map(bill => {
                  const amount = bill.actual_amount ?? bill.default_amount
                  const dueLabel = dueDayOrdinal(bill.due_day)
                  return (
                    <div key={bill.bill_id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <button
                        onClick={() => togglePaid(bill)}
                        className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                        style={bill.is_paid
                          ? { backgroundColor: '#27AE60', borderColor: '#27AE60' }
                          : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}
                      >
                        {bill.is_paid && <span className="text-white text-xs">✓</span>}
                      </button>

                      <div className="flex-1 min-w-0" onClick={() => openPaymentSheet(bill)}>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-sm font-semibold ${bill.is_paid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {bill.name}
                          </span>
                          {/* Tappable category chip — sets category filter */}
                          <button
                            onClick={e => { e.stopPropagation(); setFilterCats(prev => prev.includes(bill.category) ? prev : [...prev, bill.category]) }}
                          >
                            <CategoryChip category={bill.category} />
                          </button>
                          {/* Tappable owner chip — adds to owner filter */}
                          {bill.owner && (
                            <button
                              onClick={e => { e.stopPropagation(); setOwnerFilters(prev => prev.includes(bill.owner!) ? prev : [...prev, bill.owner!]) }}
                              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                              style={OWNER_COLORS[bill.owner]
                                ? { backgroundColor: OWNER_COLORS[bill.owner].bg, color: OWNER_COLORS[bill.owner].color }
                                : { backgroundColor: '#E5E7EB', color: '#374151' }}
                            >
                              {bill.owner}
                            </button>
                          )}
                          {bill.is_autopay && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                              ⚡ Auto
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {dueLabel && <span>Due {dueLabel}</span>}
                          {bill.account && <span className="truncate max-w-[130px]">{bill.account}</span>}
                          {bill.billing_type !== 'Fixed' && <span className="italic">{bill.billing_type}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <div className="text-right" onClick={() => openPaymentSheet(bill)}>
                          <p className={`text-base font-bold ${bill.is_paid ? 'text-gray-400' : 'text-gray-900'}`}>
                            {amount !== null ? formatCurrency(amount) : <span className="text-gray-300">—</span>}
                          </p>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => switchToEditBill(bill)}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-100 text-sm ml-1"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={sheetTitle}>

        {/* PAYMENT VIEW */}
        {sheetView === 'payment' && selectedBill && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryChip category={selectedBill.category} />
              <span className="text-xs text-gray-400">{selectedBill.billing_type}</span>
              {selectedBill.account && <span className="text-xs text-gray-400">{selectedBill.account}</span>}
              {selectedBill.is_autopay && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                  ⚡ Autopay
                </span>
              )}
            </div>
            <AmountInput label="Amount" value={editAmount} onChange={setEditAmount} placeholder={String(selectedBill.default_amount ?? '0.00')} />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditPaid(!editPaid)}
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
                style={editPaid ? { backgroundColor: '#27AE60', borderColor: '#27AE60' } : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}
              >
                {editPaid && <span className="text-white text-xs">✓</span>}
              </button>
              <span className="text-sm text-gray-700">Mark as paid</span>
            </div>
            {editPaid && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date paid</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none" />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSheetOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
              <button onClick={saveActual} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60" style={{ backgroundColor: '#1B2A4A' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {isAdmin && (
              <div className="border-t border-gray-100 pt-3">
                <button onClick={() => switchToEditBill(selectedBill)} className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm">
                  ✏️ Edit Bill Details
                </button>
              </div>
            )}
          </div>
        )}

        {/* EDIT / ADD BILL FORM */}
        {(sheetView === 'editBill' || sheetView === 'addBill') && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Netflix" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {BILL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <select value={editOwner} onChange={e => setEditOwner(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">— None —</option>
                {OWNER_LABELS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {editCategory === 'Debt' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Debt</label>
                <select value={editDebtId} onChange={e => setEditDebtId(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                  <option value="">— None —</option>
                  {debts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {editDebtId && <p className="text-xs text-teal-600 mt-1">✓ Checking off this bill will log a payment in the debt tracker</p>}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                {['Fixed', 'Variable'].map(t => (
                  <button key={t} onClick={() => setEditBillingType(t)} className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                    style={editBillingType === t ? { backgroundColor: '#1B2A4A', color: '#fff' } : { backgroundColor: '#fff', color: '#6B7280' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <AmountInput label="Default Amount" value={editDefaultAmount} onChange={setEditDefaultAmount} placeholder="0.00" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account / Card</label>
              <select value={editAccount} onChange={e => setEditAccount(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">— None —</option>
                {bankAccounts.length > 0 && <optgroup label="Bank Accounts">{bankAccounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}</optgroup>}
                {creditCards.length > 0 && <optgroup label="Credit Cards">{creditCards.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}</optgroup>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Day of Month</label>
              <select value={editDueDay} onChange={e => setEditDueDay(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {DUE_DAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select value={editFrequency} onChange={e => setEditFrequency(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <button
              onClick={() => setEditAutopay(v => !v)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors text-left"
              style={editAutopay ? { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' } : { borderColor: '#E5E7EB', backgroundColor: '#fff' }}
            >
              <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                style={editAutopay ? { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' } : { backgroundColor: 'transparent', borderColor: '#D1D5DB' }}>
                {editAutopay && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">⚡ Autopay enabled</p>
                <p className="text-xs text-gray-400">This bill is paid automatically</p>
              </div>
            </button>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSheetOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
              <button onClick={sheetView === 'editBill' ? saveBillEdit : addBill} disabled={saving || !editName} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60" style={{ backgroundColor: '#1B2A4A' }}>
                {saving ? 'Saving…' : sheetView === 'editBill' ? 'Save Changes' : 'Add Bill'}
              </button>
            </div>
            {sheetView === 'editBill' && (
              <div className="pt-1">
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="w-full py-2.5 rounded-xl text-red-500 font-medium text-sm border border-red-100">Delete Bill</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">Cancel</button>
                    <button onClick={deleteBill} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm">{saving ? 'Deleting…' : 'Confirm Delete'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </FinanceLayout>
  )
}
