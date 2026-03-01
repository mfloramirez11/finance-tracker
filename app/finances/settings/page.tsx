'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import { signOut } from 'next-auth/react'
import { formatCurrency } from '@/lib/finances/format'
import Link from 'next/link'

interface Setting { key: string; value: string; label: string | null }

const SETTING_FIELDS = [
  { key: 'biweekly_net_pay', label: 'Bi-weekly Net Pay', type: 'currency', hint: 'Your take-home pay per paycheck' },
  { key: 'pay_periods_per_year', label: 'Pay Periods / Year', type: 'number', hint: '26 = bi-weekly, 24 = semi-monthly' },
  { key: 'emergency_fund_target', label: 'Emergency Fund Goal', type: 'currency', hint: 'Target balance' },
  { key: 'emergency_fund_current', label: 'Emergency Fund Current', type: 'currency', hint: 'Current saved balance' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  // Change password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/finances/settings')
    const json = await res.json()
    const map: Record<string, string> = {}
    for (const s of json.data ?? []) map[s.key] = s.value
    setSettings(map)
    setForm(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveSettings() {
    setSaving(true)
    const updates = SETTING_FIELDS.map(f => ({ key: f.key, value: form[f.key] ?? '' }))
    await fetch('/api/finances/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchSettings()
  }

  async function changePassword() {
    setPwError('')
    if (!currentPw || !newPw || !confirmPw) { setPwError('All fields are required'); return }
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return }
    setPwSaving(true)
    const res = await fetch('/api/finances/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })
    const json = await res.json()
    setPwSaving(false)
    if (json.error) { setPwError(json.error); return }
    setPwSuccess(true)
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setTimeout(() => setPwSuccess(false), 3000)
  }

  const monthlyIncome = (() => {
    const bw = parseFloat(form.biweekly_net_pay ?? '0')
    const pp = parseInt(form.pay_periods_per_year ?? '26')
    return (bw * pp) / 12
  })()

  return (
    <FinanceLayout title="Settings">
      <div className="space-y-4">
        {/* Income settings */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Income</h2>
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 bg-gray-100 rounded-xl" />
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4">
              {SETTING_FIELDS.slice(0, 2).map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <div className="relative">
                    {f.type === 'currency' && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    )}
                    <input
                      type="number"
                      step={f.type === 'currency' ? '0.01' : '1'}
                      value={form[f.key] ?? ''}
                      onChange={e => setField(f.key, e.target.value)}
                      className={`w-full ${f.type === 'currency' ? 'pl-7' : 'pl-4'} pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400`}
                    />
                  </div>
                  {f.hint && <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>}
                </div>
              ))}
              <div className="bg-green-50 rounded-xl px-4 py-3">
                <p className="text-xs text-green-700 font-medium">Calculated monthly income</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(monthlyIncome)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Emergency fund */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Emergency Fund</h2>
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 bg-gray-100 rounded-xl" />
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4">
              {SETTING_FIELDS.slice(2).map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form[f.key] ?? ''}
                      onChange={e => setField(f.key, e.target.value)}
                      className="w-full pl-7 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  {f.hint && <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={saveSettings}
          disabled={saving || loading}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-base disabled:opacity-60 transition-colors"
          style={{ backgroundColor: saved ? '#27AE60' : '#1B2A4A' }}
        >
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>

        {/* Change password */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Change Password</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            {pwError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{pwError}</p>
            )}
            <button
              onClick={changePassword}
              disabled={pwSaving}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60 transition-colors"
              style={{ backgroundColor: pwSuccess ? '#27AE60' : '#2DB5AD' }}
            >
              {pwSuccess ? '✓ Password Changed!' : pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </div>

        {/* Navigation links */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 mb-2">More</h2>
          <Link href="/finances/history" className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 active:bg-gray-50">
            <span className="text-sm font-medium text-gray-800">Bill Change History</span>
            <span className="text-gray-400">→</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50"
          >
            <span className="text-sm font-medium text-red-500">Sign Out</span>
            <span className="text-red-400">→</span>
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 pb-2">Finance Tracker · Flores Household</p>
      </div>
    </FinanceLayout>
  )
}
