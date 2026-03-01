'use client'

import { useEffect, useState, useCallback } from 'react'
import FinanceLayout from '@/components/finances/FinanceLayout'
import TrendChart from '@/components/finances/TrendChart'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import SummaryCard from '@/components/finances/SummaryCard'
import { formatCurrency, shortMonthName } from '@/lib/finances/format'

const CHART_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function TrendsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chartView, setChartView] = useState<'monthly' | 'category' | 'debt'>('monthly')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finances/trends?year=${year}`)
    const json = await res.json()
    setData(json.data)
    setLoading(false)
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  // Build chart data
  const monthlyChartData = CHART_MONTHS.map((label, i) => {
    const m = i + 1
    const current = data?.monthlyTotals?.find((r: any) => Number(r.month) === m)
    const last = data?.lastYearTotals?.find((r: any) => Number(r.month) === m)
    return {
      month: label,
      [year]: parseFloat(current?.total ?? 0),
      [year - 1]: parseFloat(last?.total ?? 0),
    }
  })

  const categoryChartData = (data?.categoryTotals ?? []).map((c: any) => ({
    category: c.category,
    total: parseFloat(c.total),
  }))

  const debtChartData = CHART_MONTHS.map((label, i) => {
    const m = i + 1
    const p = data?.debtPayments?.find((r: any) => Number(r.month) === m)
    return { month: label, Payments: parseFloat(p?.total_paid ?? 0) }
  })

  const totalSpend = (data?.monthlyTotals ?? []).reduce((s: number, r: any) => s + parseFloat(r.total ?? 0), 0)
  const avgMonthly = data?.monthlyTotals?.length > 0
    ? totalSpend / data.monthlyTotals.length
    : 0
  const topCategory = data?.categoryTotals?.[0]

  return (
    <FinanceLayout title="Spending Trends">
      {/* Year selector */}
      <div className="flex gap-2 mb-4">
        {[2025, 2026, 2027].map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={year === y ? { backgroundColor: '#1B2A4A', color: '#fff' } : { backgroundColor: '#E5E7EB', color: '#374151' }}
          >
            {y}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton rows={3} /> : (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard title="Total Tracked">
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalSpend)}</p>
              <p className="text-xs text-gray-400">{year} YTD</p>
            </SummaryCard>
            <SummaryCard title="Avg Monthly">
              <p className="text-xl font-bold text-gray-900">{formatCurrency(avgMonthly)}</p>
              <p className="text-xs text-gray-400">across tracked months</p>
            </SummaryCard>
          </div>

          {topCategory && (
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-xs text-gray-400">Top expense category</p>
                <p className="text-sm font-semibold text-gray-900">{topCategory.category}</p>
                <p className="text-xs text-gray-500">{formatCurrency(topCategory.total)}</p>
              </div>
            </div>
          )}

          {/* Chart view tabs */}
          <div className="flex gap-2">
            {(['monthly', 'category', 'debt'] as const).map(v => (
              <button
                key={v}
                onClick={() => setChartView(v)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize"
                style={chartView === v
                  ? { backgroundColor: '#2DB5AD', color: '#fff' }
                  : { backgroundColor: '#E5E7EB', color: '#374151' }}
              >
                {v === 'monthly' ? 'Month vs LY' : v === 'category' ? 'By Category' : 'Debt Payments'}
              </button>
            ))}
          </div>

          {/* Charts */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            {chartView === 'monthly' && (
              <>
                <p className="text-sm font-semibold text-gray-600 mb-3">{year} vs {year - 1} Monthly Spend</p>
                <TrendChart
                  type="bar"
                  data={monthlyChartData}
                  dataKeys={[String(year), String(year - 1)]}
                  xKey="month"
                  height={240}
                />
              </>
            )}
            {chartView === 'category' && (
              <>
                <p className="text-sm font-semibold text-gray-600 mb-3">Spending by Category — {year}</p>
                <TrendChart
                  type="bar"
                  data={categoryChartData}
                  dataKeys={['total']}
                  xKey="category"
                  height={240}
                />
              </>
            )}
            {chartView === 'debt' && (
              <>
                <p className="text-sm font-semibold text-gray-600 mb-3">Debt Payments — {year}</p>
                <TrendChart
                  type="bar"
                  data={debtChartData}
                  dataKeys={['Payments']}
                  xKey="month"
                  height={240}
                />
              </>
            )}
          </div>

          {/* Category breakdown table */}
          {chartView === 'category' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-600 mb-3">Category Breakdown</p>
              <div className="space-y-2">
                {data.categoryTotals.map((c: any) => (
                  <div key={c.category} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{c.category}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </FinanceLayout>
  )
}
