'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import BottomSheet from '@/components/finances/BottomSheet'
import CategoryChip from '@/components/finances/CategoryChip'
import AmountInput from '@/components/finances/AmountInput'
import EmptyState from '@/components/finances/EmptyState'
import { formatCurrency, formatDate } from '@/lib/finances/format'

interface HistoryEntry {
  id: string
  bill_id: string | null
  change_date: string
  category: string | null
  bill_name: string
  old_provider: string | null
  old_amount: number | null
  new_provider: string | null
  new_amount: number | null
  reason: string | null
  created_at: string
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add form
  const [form, setForm] = useState({
    bill_name: '',
    category: 'Utilities',
    change_date: new Date().toISOString().split('T')[0],
    old_provider: '',
    old_amount: '',
    new_provider: '',
    new_amount: '',
    reason: '',
  })

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/finances/history')
    const json = await res.json()
    setEntries(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveEntry() {
    if (!form.bill_name || !form.change_date) return
    setSaving(true)
    await fetch('/api/finances/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bill_name: form.bill_name,
        category: form.category,
        change_date: form.change_date,
        old_provider: form.old_provider || null,
        old_amount: form.old_amount ? parseFloat(form.old_amount) : null,
        new_provider: form.new_provider || null,
        new_amount: form.new_amount ? parseFloat(form.new_amount) : null,
        reason: form.reason || null,
      }),
    })
    setSaving(false)
    setAddOpen(false)
    setForm({ bill_name: '', category: 'Utilities', change_date: new Date().toISOString().split('T')[0], old_provider: '', old_amount: '', new_provider: '', new_amount: '', reason: '' })
    fetchHistory()
  }

  // Group by year
  const grouped: Record<number, HistoryEntry[]> = {}
  for (const e of entries) {
    const yr = new Date(e.change_date).getFullYear()
    if (!grouped[yr]) grouped[yr] = []
    grouped[yr].push(e)
  }
  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a)

  return (
    <FinanceLayout
      title="Bill History"
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
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon="📋" message="No history yet" submessage="Tap + to log a bill change" />
      ) : (
        <div className="space-y-6">
          {years.map(yr => (
            <div key={yr}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{yr}</h2>
              <div className="space-y-2">
                {grouped[yr].map(entry => {
                  const savingsDiff = (entry.old_amount ?? 0) - (entry.new_amount ?? 0)
                  return (
                    <div key={entry.id} className="bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-bold text-gray-900">{entry.bill_name}</span>
                            {entry.category && <CategoryChip category={entry.category} />}
                          </div>
                          <p className="text-xs text-gray-400">{formatDate(entry.change_date.split('T')[0])}</p>
                        </div>
                        {savingsDiff !== 0 && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: savingsDiff > 0 ? '#D1FAE5' : '#FEE2E2',
                              color: savingsDiff > 0 ? '#065F46' : '#991B1B',
                            }}
                          >
                            {savingsDiff > 0 ? '−' : '+'}{formatCurrency(Math.abs(savingsDiff))}/mo
                          </span>
                        )}
                      </div>

                      {/* Change detail */}
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex-1 bg-red-50 rounded-lg px-3 py-2">
                          {entry.old_provider && <p className="text-xs text-gray-500">{entry.old_provider}</p>}
                          {entry.old_amount != null && <p className="font-semibold text-red-600">{formatCurrency(entry.old_amount)}</p>}
                          {!entry.old_provider && !entry.old_amount && <p className="text-xs text-gray-400 italic">—</p>}
                        </div>
                        <span className="text-gray-400 font-bold shrink-0">→</span>
                        <div className="flex-1 bg-green-50 rounded-lg px-3 py-2">
                          {entry.new_provider && <p className="text-xs text-gray-500">{entry.new_provider}</p>}
                          {entry.new_amount != null && <p className="font-semibold text-green-700">{formatCurrency(entry.new_amount)}</p>}
                          {!entry.new_provider && !entry.new_amount && <p className="text-xs text-gray-400 italic">—</p>}
                        </div>
                      </div>

                      {entry.reason && (
                        <p className="text-xs text-gray-500 mt-2 italic">{entry.reason}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Sheet */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Log Bill Change">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.bill_name}
              onChange={e => setField('bill_name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
              placeholder="e.g. AT&T Fiber"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 bg-white"
            >
              {['Housing', 'Auto', 'Utilities', 'Wireless', 'Insurance', 'Debt', 'Subscriptions', 'Family', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change Date</label>
            <input
              type="date"
              value={form.change_date}
              onChange={e => setField('change_date', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Old Provider</label>
              <input type="text" value={form.old_provider} onChange={e => setField('old_provider', e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-xl text-gray-900 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Provider</label>
              <input type="text" value={form.new_provider} onChange={e => setField('new_provider', e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-xl text-gray-900 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AmountInput label="Old Amount" value={form.old_amount} onChange={v => setField('old_amount', v)} />
            <AmountInput label="New Amount" value={form.new_amount} onChange={v => setField('new_amount', v)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes</label>
            <textarea
              value={form.reason}
              onChange={e => setField('reason', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-sm resize-none"
              placeholder="e.g. Switched to cheaper plan"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
            <button
              onClick={saveEntry}
              disabled={saving || !form.bill_name || !form.change_date}
              className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60"
              style={{ backgroundColor: '#2DB5AD' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </FinanceLayout>
  )
}
