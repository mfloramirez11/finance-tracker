'use client'

import { Suspense, useEffect, useState, useCallback, useMemo, useDeferredValue } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import AlertBadge from '@/components/finances/AlertBadge'
import CategoryChip, { CATEGORY_COLORS } from '@/components/finances/CategoryChip'
import AmountInput from '@/components/finances/AmountInput'
import ProgressBar from '@/components/finances/ProgressBar'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import EmptyState from '@/components/finances/EmptyState'
import { formatCurrency, formatDate, daysUntil } from '@/lib/finances/format'

const CATEGORIES = ['Auto', 'Credit Card', 'Health', 'Housing', 'Insurance', 'Subscriptions', 'Tech', 'Other']
const CAT_OPTIONS = CATEGORIES // no 'All' entry — empty array means All
const OWNER_LABELS = ['Manny', 'Celesti', 'Manny & Celesti', 'Family Flores']
const OWNER_COLORS: Record<string, { bg: string; color: string }> = {
  'Manny':           { bg: '#DBEAFE', color: '#1D4ED8' },
  'Celesti':         { bg: '#FCE7F3', color: '#BE185D' },
  'Manny & Celesti': { bg: '#EDE9FE', color: '#7C3AED' },
  'Family Flores':   { bg: '#DCFCE7', color: '#166534' },
}

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
  owner: string | null
}

interface AnnualData {
  items: AnnualItem[]
  total: number
  paid: number
  remaining: number
}

const EMPTY_EDIT = { name: '', category: 'Auto', amount: '', dueDate: '', account: '', isPaid: false, paidDate: '', owner: '' }

// Suspense wrapper required for useSearchParams in Next.js App Router
export default function AnnualPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={5} />}>
      <AnnualPageInner />
    </Suspense>
  )
}

function AnnualPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<AnnualData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])

  // Filters — initialized from URL params
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [filterCats, setFilterCats] = useState<string[]>(() => searchParams.get('cats')?.split(',').filter(Boolean) ?? [])
  const [filterOwners, setFilterOwners] = useState<string[]>(() => searchParams.get('owners')?.split(',').filter(Boolean) ?? [])
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>(() => (searchParams.get('paid') as 'all' | 'paid' | 'unpaid') ?? 'all')
  const [sortBy, setSortBy] = useState<'due_date' | 'name' | 'category'>(() => (searchParams.get('sort') as 'due_date' | 'name' | 'category') ?? 'due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc')

  // List animation
  const [listRef] = useAutoAnimate()
  // Deferred search — keeps the input snappy; filter re-runs on a lower priority
  const deferredSearch = useDeferredValue(search)

  // Edit sheet
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<AnnualItem | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Add sheet
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_EDIT)

  // Sync filters to URL — debounced 300 ms so rapid keystrokes don't spam history
  useEffect(() => {
    const id = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterCats.length) params.set('cats', filterCats.join(','))
      if (filterOwners.length) params.set('owners', filterOwners.join(','))
      if (filterPaid !== 'all') params.set('paid', filterPaid)
      if (sortBy !== 'due_date') params.set('sort', sortBy)
      if (sortDir !== 'asc') params.set('dir', sortDir)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 300)
    return () => clearTimeout(id)
  }, [search, filterCats, filterOwners, filterPaid, sortBy, sortDir, pathname, router])

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finances/annual?year=${year}`, signal ? { signal } : undefined)
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }, [year])

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/finances/accounts')
    if (!res.ok) return
    const json = await res.json()
    setAccounts(json.data ?? [])
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])
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
      owner: item.owner ?? '',
    })
    setConfirmDelete(false)
    setSaveError(null)
    setEditOpen(true)
  }

  // Shared fetch wrapper — returns parsed json on success, sets saveError and returns null on failure
  async function apiFetch(url: string, opts: RequestInit): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(url, opts)
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setSaveError(json.error ?? 'Something went wrong. Please try again.')
        return null
      }
      return json as Record<string, unknown>
    } catch {
      setSaveError('Network error. Please check your connection and try again.')
      return null
    }
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    setSaveError(null)
    const ok = await apiFetch(`/api/finances/annual/${selected.id}`, {
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
        owner: editForm.owner || null,
      }),
    })
    setSaving(false)
    if (!ok) return  // stay in sheet, error is displayed
    setEditOpen(false)
    fetchData()
  }

  async function deleteItem() {
    if (!selected) return
    setDeleting(true)
    setSaveError(null)
    const ok = await apiFetch(`/api/finances/annual/${selected.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!ok) return  // stay in sheet, error is displayed
    setEditOpen(false)
    setConfirmDelete(false)
    fetchData()
  }

  async function saveAdd() {
    if (!addForm.name || !addForm.amount || !addForm.dueDate) return
    setSaving(true)
    setSaveError(null)
    const ok = await apiFetch('/api/finances/annual', {
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
        owner: addForm.owner || null,
      }),
    })
    setSaving(false)
    if (!ok) return  // stay in sheet, error is displayed
    setAddOpen(false)
    setAddForm({ ...EMPTY_EDIT })
    fetchData()
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

  // Sort — memoized so unrelated state changes (saving, editOpen, etc.) don't re-sort
  const sortedItems = useMemo(() => [...(data?.items ?? [])].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortBy === 'category') {
      const catCmp = a.category.localeCompare(b.category)
      cmp = catCmp !== 0 ? catCmp : a.due_date.localeCompare(b.due_date)
    } else {
      cmp = a.due_date.localeCompare(b.due_date)
    }
    return sortDir === 'desc' ? -cmp : cmp
  }), [data, sortBy, sortDir])

  // Filter — uses deferredSearch so typing stays instantaneous
  const filtered = useMemo(() => sortedItems.filter(item => {
    const q = deferredSearch.toLowerCase()
    if (q && !item.name.toLowerCase().includes(q) && !(item.account ?? '').toLowerCase().includes(q)) return false
    if (filterOwners.length > 0 && !filterOwners.includes(item.owner ?? '')) return false
    if (filterCats.length > 0 && !filterCats.includes(item.category)) return false
    if (filterPaid === 'paid') return item.is_paid
    if (filterPaid === 'unpaid') return !item.is_paid
    return true
  }), [sortedItems, deferredSearch, filterOwners, filterCats, filterPaid])

  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const creditCards = accounts.filter(a => a.type === 'credit_card')

  // Stats respect owner + category filters (but not paid filter, so bar always shows full scope)
  const statItems = useMemo(() => (data?.items ?? []).filter(i => {
    if (filterOwners.length > 0 && !filterOwners.includes(i.owner ?? '')) return false
    if (filterCats.length > 0 && !filterCats.includes(i.category)) return false
    return true
  }), [data, filterOwners, filterCats])

  const displayTotal = statItems.reduce((s, i) => s + parseFloat(String(i.amount)), 0)
  const displayPaid = statItems.filter(i => i.is_paid).reduce((s, i) => s + parseFloat(String(i.amount)), 0)
  const paidPct = displayTotal > 0 ? (displayPaid / displayTotal) * 100 : 0
  const activeCatColor = filterCats.length === 1 ? (CATEGORY_COLORS[filterCats[0]]?.bg ?? '#2DB5AD') : undefined
  const hasActiveFilters = search !== '' || filterCats.length > 0 || filterOwners.length > 0 || filterPaid !== 'all'

  // Group filtered items by category when sortBy === 'category'
  const groupedFiltered = useMemo((): Array<{ header: string | null; items: AnnualItem[] }> => {
    if (sortBy !== 'category') return [{ header: null, items: filtered }]
    const groups: Record<string, AnnualItem[]> = {}
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return Object.entries(groups).map(([cat, catItems]) => ({ header: cat, items: catItems }))
  }, [filtered, sortBy])

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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
        <select
          value={form.owner}
          onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white"
        >
          <option value="">— None —</option>
          {OWNER_LABELS.map(o => <option key={o} value={o}>{o}</option>)}
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
          onClick={() => { setAddForm({ ...EMPTY_EDIT }); setSaveError(null); setAddOpen(true) }}
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

      {/* Search */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search expenses…"
          className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
        )}
      </div>

      {/* Owner filters */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterOwners([])}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
          style={filterOwners.length === 0
            ? { backgroundColor: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }
            : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
        >
          👥 All
        </button>
        {OWNER_LABELS.map(o => {
          const active = filterOwners.includes(o)
          const col = OWNER_COLORS[o] ?? { bg: '#7C3AED', color: '#fff' }
          return (
            <button
              key={o}
              onClick={() => setFilterOwners(prev => active ? prev.filter(x => x !== o) : [...prev, o])}
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
      </div>

      {/* Paid / unpaid tabs */}
      <div className="flex gap-2 mb-3">
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

      {/* Clear All Filters — only visible when any filter is active */}
      {hasActiveFilters && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => { setSearch(''); setFilterCats([]); setFilterOwners([]); setFilterPaid('all') }}
            className="text-xs font-semibold px-3 py-1 rounded-full border"
            style={{ color: '#D94F3D', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}
          >
            ✕ Clear all filters
          </button>
        </div>
      )}

      {/* Items list — grouped by category when sort=category, flat otherwise */}
      {loading ? <LoadingSkeleton rows={5} /> : (
        <div ref={listRef} className="space-y-2">
          {filtered.length === 0 && (
            <EmptyState
              icon={hasActiveFilters ? '🔍' : '📭'}
              message={hasActiveFilters ? 'No expenses match your filters' : 'No expenses this year'}
              submessage={hasActiveFilters ? 'Try clearing some filters to see more results' : undefined}
            />
          )}
          {groupedFiltered.map(({ header, items: groupItems }) => (
            <div key={header ?? 'all'}>
              {header && (
                <div className="flex items-center gap-2 px-1 pt-3 pb-1">
                  <CategoryChip category={header} />
                  <span className="text-xs text-gray-400 font-medium">{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="space-y-2">
                {groupItems.map(item => {
                  const dueDateStr = item.due_date.split('T')[0]
                  const days = daysUntil(dueDateStr)
                  return (
                    <div
                      key={item.id}
                      onClick={() => openEdit(item)}
                      className={`bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3 cursor-pointer active:scale-[0.99] transition-transform ${item.is_paid ? 'opacity-60' : ''}`}
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
                          {/* Tappable category chip — adds category to filter */}
                          <button
                            onClick={e => { e.stopPropagation(); setFilterCats(prev => prev.includes(item.category) ? prev : [...prev, item.category]) }}
                          >
                            <CategoryChip category={item.category} />
                          </button>
                          {/* Tappable owner chip — adds owner to filter */}
                          {item.owner && (
                            <button
                              onClick={e => { e.stopPropagation(); setFilterOwners(prev => prev.includes(item.owner!) ? prev : [...prev, item.owner!]) }}
                              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                              style={OWNER_COLORS[item.owner]
                                ? { backgroundColor: OWNER_COLORS[item.owner].bg, color: OWNER_COLORS[item.owner].color }
                                : { backgroundColor: '#E5E7EB', color: '#374151' }}
                            >
                              {item.owner}
                            </button>
                          )}
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
            </div>
          ))}
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
            {saveError && (
              <p className="text-xs text-rose-600 text-center font-medium px-1">⚠️ {saveError}</p>
            )}

            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-xl text-red-500 text-sm font-medium border border-red-100 bg-red-50 active:bg-red-100">
                Delete this expense
              </button>
            ) : (
              <div className="bg-red-50 rounded-xl p-3 space-y-2">
                <p className="text-sm font-medium text-red-700 text-center">Delete &quot;{selected.name}&quot;?</p>
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
          {saveError && (
            <p className="text-xs text-rose-600 text-center font-medium px-1">⚠️ {saveError}</p>
          )}
        </div>
      </BottomSheet>
    </FinanceLayout>
  )
}
