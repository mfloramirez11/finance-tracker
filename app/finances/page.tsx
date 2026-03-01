'use client'

import { useEffect, useState } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import SummaryCard from '@/components/finances/SummaryCard'
import ProgressBar from '@/components/finances/ProgressBar'
import AlertBadge from '@/components/finances/AlertBadge'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, formatDate, daysUntil, monthName } from '@/lib/finances/format'
import Link from 'next/link'

interface DashboardData {
  income: { biweeklyPay: number; monthlyIncome: number }
  monthly: {
    year: number; month: number; total: number; paid: number
    unpaid: number; paidCount: number; totalCount: number; leftover: number
  }
  annual: { year: number; total: number; paid: number; upcoming: any[] }
  debts: { items: any[]; total: number; bofaDaysLeft: number | null }
  settings: Record<string, string>
}

export default function DashboardPage() {
  const now = new Date()
  const [year] = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/finances/dashboard?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month])

  const paidPct = data ? (data.monthly.paid / (data.monthly.total || 1)) * 100 : 0
  const annualPaidPct = data ? (data.annual.paid / (data.annual.total || 1)) * 100 : 0

  return (
    <FinanceLayout title="Dashboard">
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : !data ? (
        <div className="text-center py-12 text-gray-400">Failed to load dashboard</div>
      ) : (
        <div className="space-y-4">
          {/* BofA Alert — urgent */}
          {data.debts.bofaDaysLeft !== null && data.debts.bofaDaysLeft <= 90 && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ backgroundColor: data.debts.bofaDaysLeft <= 30 ? '#FEE2E2' : '#FEF3C7' }}
            >
              <span className="text-2xl">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">BofA 0% Promo Deadline</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Pay off {formatCurrency(data.debts.items.find(d => d.promo_end_date)?.current_balance)} before
                  {' '}{formatDate(data.debts.items.find(d => d.promo_end_date)?.promo_end_date)}
                </p>
              </div>
              <AlertBadge days={data.debts.bofaDaysLeft} />
            </div>
          )}

          {/* Monthly bills progress */}
          <SummaryCard
            title={`${monthName(month)} Bills`}
            badge={<Link href="/finances/monthly" className="text-xs font-medium" style={{ color: '#2DB5AD' }}>View all →</Link>}
          >
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.monthly.paid)}</p>
                <p className="text-xs text-gray-400">paid of {formatCurrency(data.monthly.total)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold" style={{ color: '#D94F3D' }}>{formatCurrency(data.monthly.unpaid)}</p>
                <p className="text-xs text-gray-400">remaining</p>
              </div>
            </div>
            <ProgressBar value={paidPct} />
            <p className="text-xs text-gray-400 mt-1.5">{data.monthly.paidCount} of {data.monthly.totalCount} bills paid</p>
          </SummaryCard>

          {/* Annual tracker */}
          <SummaryCard
            title={`${year} Annual Expenses`}
            badge={<Link href="/finances/annual" className="text-xs font-medium" style={{ color: '#2DB5AD' }}>View all →</Link>}
          >
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(data.annual.paid)}</p>
                <p className="text-xs text-gray-400">paid of {formatCurrency(data.annual.total)}</p>
              </div>
              <p className="text-sm font-medium text-gray-500">{annualPaidPct.toFixed(0)}%</p>
            </div>
            <ProgressBar value={annualPaidPct} />
            {data.annual.upcoming.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coming up</p>
                {data.annual.upcoming.slice(0, 3).map((item: any) => {
                  const days = daysUntil(item.due_date.split('T')[0])
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate flex-1">{item.name}</span>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                        <AlertBadge days={days} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SummaryCard>

          {/* Debt overview */}
          <SummaryCard
            title="Debt Overview"
            badge={<Link href="/finances/debts" className="text-xs font-medium" style={{ color: '#2DB5AD' }}>View all →</Link>}
          >
            <p className="text-2xl font-bold mb-3" style={{ color: '#D94F3D' }}>{formatCurrency(data.debts.total)}</p>
            <div className="space-y-2">
              {data.debts.items.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                    {d.promo_end_date && (
                      <p className="text-xs text-amber-600">0% promo ends {formatDate(d.promo_end_date.split('T')[0])}</p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 ml-3">{formatCurrency(d.current_balance)}</p>
                </div>
              ))}
            </div>
          </SummaryCard>

        </div>
      )}
    </FinanceLayout>
  )
}
