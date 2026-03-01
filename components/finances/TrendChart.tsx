'use client'

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatCurrency } from '@/lib/finances/format'

const COLORS = ['#2DB5AD', '#1B2A4A', '#F0A500', '#D94F3D', '#27AE60', '#7C3AED', '#F39C12', '#0891B2']

interface TrendChartProps {
  type: 'bar' | 'line' | 'stacked-bar'
  data: Record<string, any>[]
  dataKeys: string[]
  xKey: string
  height?: number
}

const formatYAxis = (v: number) => `$${(v / 1000).toFixed(0)}k`

export default function TrendChart({ type, data, dataKeys, xKey, height = 250 }: TrendChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any) => formatCurrency(typeof value === 'number' ? value : 0)

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend />
          {dataKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'stacked-bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend />
          {dataKeys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Default: grouped bar
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} width={40} />
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
        {dataKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
