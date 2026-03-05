'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import FinanceLayout from '@/components/finances/FinanceLayout'
import SummaryCard from '@/components/finances/SummaryCard'
import ProgressBar from '@/components/finances/ProgressBar'
import LoadingSkeleton from '@/components/finances/LoadingSkeleton'
import { formatCurrency, monthName } from '@/lib/finances/format'

/* ── Types ─────────────────────────────────────────── */
interface Rec {
  type: 'info' | 'warning' | 'alert' | 'success'
  title: string
  message: string
}

interface InsightsData {
  kpis: {
    monthlyTotal: number
    monthlyIncome: number
    paidTotal: number
    leftover: number
    fixedTotal: number
    variableTotal: number
    unpaidCount: number
    totalCount: number
    largestBill: { name: string; amount: number } | null
  }
  categoryBreakdown: { category: string; amount: number; pct: number }[]
  monthlyTrend: { label: string; total: number; fixed: number; variable: number }[]
  annual: {
    total: number
    paid: number
    remaining: number
    byCategory: { category: string; total: number; paid: number }[]
  }
  debts: { total: number; bofaDaysLeft: number | null }
  recommendations: Rec[]
}

/* ── Constants ─────────────────────────────────────── */
const CAT_COLORS = [
  '#2DB5AD', '#1B2A4A', '#F0A500', '#D94F3D',
  '#27AE60', '#7C3AED', '#0891B2', '#F97316',
]

const REC_STYLES: Record<Rec['type'], { border: string; bg: string; badge: string }> = {
  alert:   { border: '#D94F3D', bg: '#FEF2F2', badge: '#D94F3D' },
  warning: { border: '#F0A500', bg: '#FFFBEB', badge: '#92400E' },
  success: { border: '#27AE60', bg: '#F0FDF4', badge: '#166534' },
  info:    { border: '#2DB5AD', bg: '#F0FDFC', badge: '#065F46' },
}

const REC_ICONS: Record<Rec['type'], string> = {
  alert: '🔴', warning: '⚠️', success: '✅', info: 'ℹ️',
}

/* ── Helpers ───────────────────────────────────────── */
function formatYAxis(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.fill }} />
          <span className="text-gray-500 capitalize">{p.dataKey}:</span>
          <span className="font-medium text-gray-800">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Page ──────────────────────────────────────────── */
export default function InsightsPage() {
  const now = new Date()
  const [year] = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/finances/insights?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month])

  return (
    <FinanceLayout title="Insights">
      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : !data ? (
        <div className="text-center py-12 text-gray-400">Failed to load insights</div>
      ) : (
        <div className="space-y-4">

          {/* ── KPI Cards ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Monthly spend */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                {monthName(month)} Bills
              </p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(data.kpis.monthlyTotal)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.kpis.paidTotal > 0 ? `${formatCurrency(data.kpis.paidTotal)} paid` : 'none paid yet'}
              </p>
            </div>

            {/* Leftover */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Monthly Leftover
              </p>
              <p
                className="text-xl font-bold"
                style={{ color: data.kpis.leftover >= 0 ? '#27AE60' : '#D94F3D' }}
              >
                {formatCurrency(data.kpis.leftover)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                of {formatCurrency(data.kpis.monthlyIncome)} income
              </p>
            </div>

            {/* Paid progress */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Bills Paid</p>
                <p className="text-xs font-semibold text-gray-500">
                  {data.kpis.totalCount - data.kpis.unpaidCount} / {data.kpis.totalCount}
                </p>
              </div>
              <ProgressBar
                value={data.kpis.totalCount > 0
                  ? ((data.kpis.totalCount - data.kpis.unpaidCount) / data.kpis.totalCount) * 100
                  : 0}
              />
              {data.kpis.largestBill && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Largest: <span className="font-medium text-gray-600">{data.kpis.largestBill.name}</span>
                  {' '}· {formatCurrency(data.kpis.largestBill.amount)}
                </p>
              )}
            </div>
          </div>

          {/* ── Monthly Trend ──────────────────────────── */}
          <SummaryCard title="12-Month Trend">
            <div className="flex gap-4 mb-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#1B2A4A' }} />
                <span className="text-gray-500">Fixed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#2DB5AD' }} />
                <span className="text-gray-500">Variable</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="fixed" stackId="a" fill="#1B2A4A" radius={[0, 0, 0, 0]} />
                <Bar dataKey="variable" stackId="a" fill="#2DB5AD" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SummaryCard>

          {/* ── Category Breakdown ─────────────────────── */}
          {data.categoryBreakdown.length > 0 && (
            <SummaryCard title={`${monthName(month)} by Category`}>
              <div className="space-y-3">
                {data.categoryBreakdown.map((cat, i) => (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }}
                        />
                        <span className="text-sm text-gray-700">{cat.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(cat.amount)}</span>
                        <span className="text-xs text-gray-400 w-7 text-right">{cat.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${cat.pct}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Fixed vs Variable split */}
              {(data.kpis.fixedTotal + data.kpis.variableTotal) > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Fixed</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(data.kpis.fixedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Variable</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(data.kpis.variableTotal)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Fixed %</p>
                    <p className="text-sm font-bold" style={{ color: '#1B2A4A' }}>
                      {Math.round((data.kpis.fixedTotal / (data.kpis.fixedTotal + data.kpis.variableTotal)) * 100)}%
                    </p>
                  </div>
                </div>
              )}
            </SummaryCard>
          )}

          {/* ── Annual YTD ─────────────────────────────── */}
          {data.annual.total > 0 && (
            <SummaryCard title={`${year} Annual YTD`}>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(data.annual.paid)}</p>
                  <p className="text-xs text-gray-400">paid of {formatCurrency(data.annual.total)}</p>
                </div>
                <p className="text-sm font-medium text-gray-500">
                  {data.annual.total > 0
                    ? `${Math.round((data.annual.paid / data.annual.total) * 100)}%`
                    : '0%'}
                </p>
              </div>
              <ProgressBar
                value={data.annual.total > 0 ? (data.annual.paid / data.annual.total) * 100 : 0}
              />
              {data.annual.remaining > 0 && (
                <p className="text-xs mt-1.5" style={{ color: '#D94F3D' }}>
                  {formatCurrency(data.annual.remaining)} remaining
                </p>
              )}

              {data.annual.byCategory.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">By Category</p>
                  {data.annual.byCategory.map((cat, i) => {
                    const paidPct = cat.total > 0 ? (cat.paid / cat.total) * 100 : 0
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-gray-600">{cat.category}</span>
                          <span className="text-xs font-medium text-gray-700">
                            {formatCurrency(cat.paid)} / {formatCurrency(cat.total)}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${paidPct}%`,
                              backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SummaryCard>
          )}

          {/* ── Category Donut ─────────────────────────── */}
          {data.categoryBreakdown.length > 0 && (
            <SummaryCard title="Spending Mix">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {data.categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{value}</span>
                    )}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value as number), 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </SummaryCard>
          )}

          {/* ── Recommendations ────────────────────────── */}
          {data.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                Insights & Recommendations
              </p>
              <div className="grid grid-cols-2 gap-3">
                {data.recommendations.map((rec, i) => {
                  const style = REC_STYLES[rec.type]
                  return (
                    <div
                      key={i}
                      className="rounded-2xl p-3 shadow-sm"
                      style={{
                        backgroundColor: style.bg,
                        borderLeft: `3px solid ${style.border}`,
                        border: `1px solid ${style.border}22`,
                        borderLeftWidth: 3,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{REC_ICONS[rec.type]}</span>
                        <p className="text-[11px] font-bold text-gray-800 leading-tight">{rec.title}</p>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-snug">{rec.message}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </FinanceLayout>
  )
}
