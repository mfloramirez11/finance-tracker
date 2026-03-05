import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(url.searchParams.get('month') ?? String(new Date().getMonth() + 1))

  // ---- Settings ----
  const settings = await sql`SELECT key, value FROM finance_settings`
  const settingsMap: Record<string, string> = {}
  for (const s of settings) settingsMap[s.key as string] = s.value as string
  const biweeklyPay = parseFloat(settingsMap.biweekly_net_pay ?? '0')
  const payPeriods = parseInt(settingsMap.pay_periods_per_year ?? '26')
  const monthlyIncome = (biweeklyPay * payPeriods) / 12

  // ---- Current month bills ----
  const currentBills = await sql`
    SELECT
      b.id, b.name, b.category, b.billing_type, b.default_amount, b.credit_amount, b.due_day,
      a.amount as actual_amount, a.is_paid, a.paid_date
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${year} AND a.month = ${month}
    WHERE b.is_active = true
      AND (b.months_active IS NULL OR ${month} = ANY(b.months_active))
  `

  const netBillAmt = (b: any) => {
    const gross = parseFloat(b.actual_amount ?? b.default_amount ?? 0)
    const credit = parseFloat(b.credit_amount ?? 0) || 0
    return Math.max(0, gross - credit)
  }

  const monthlyTotal = currentBills.reduce((sum: number, b: any) => sum + netBillAmt(b), 0)
  const paidTotal = currentBills.filter((b: any) => b.is_paid).reduce((sum: number, b: any) => sum + netBillAmt(b), 0)
  const leftover = monthlyIncome - monthlyTotal
  const unpaidCount = currentBills.filter((b: any) => !b.is_paid).length

  // Category breakdown (current month)
  const categoryMap: Record<string, number> = {}
  for (const b of currentBills) {
    const cat = b.category as string
    categoryMap[cat] = (categoryMap[cat] ?? 0) + netBillAmt(b)
  }
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      pct: monthlyTotal > 0 ? Math.round((amount / monthlyTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // Largest bill
  const sortedBills = [...currentBills].sort((a: any, b: any) => netBillAmt(b) - netBillAmt(a))
  const largestBill = sortedBills[0]
    ? { name: sortedBills[0].name as string, amount: Math.round(netBillAmt(sortedBills[0]) * 100) / 100 }
    : null

  // Fixed vs Variable
  const fixedTotal = currentBills
    .filter((b: any) => b.billing_type === 'Fixed')
    .reduce((s: number, b: any) => s + netBillAmt(b), 0)
  const variableTotal = currentBills
    .filter((b: any) => b.billing_type === 'Variable')
    .reduce((s: number, b: any) => s + netBillAmt(b), 0)

  // ---- Last 12 months trend (from actuals) ----
  const startDate = new Date(year, month - 1 - 11, 1)
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth() + 1

  const historicalActuals = await sql`
    SELECT
      a.year, a.month,
      b.billing_type,
      SUM(
        GREATEST(0, COALESCE(a.amount, b.default_amount, 0)::numeric - COALESCE(b.credit_amount, 0)::numeric)
      ) as total
    FROM finance_actuals a
    JOIN finance_bills b ON b.id = a.bill_id
    WHERE (a.year > ${startYear} OR (a.year = ${startYear} AND a.month >= ${startMonth}))
      AND (a.year < ${year} OR (a.year = ${year} AND a.month <= ${month}))
    GROUP BY a.year, a.month, b.billing_type
    ORDER BY a.year, a.month
  `

  // Build 12-month timeline
  const monthlyTrend: { label: string; total: number; fixed: number; variable: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
    const rows = historicalActuals.filter((r: any) => Number(r.year) === y && Number(r.month) === m)
    const fixed = rows.filter((r: any) => r.billing_type === 'Fixed').reduce((s: number, r: any) => s + parseFloat(r.total ?? 0), 0)
    const variable = rows.filter((r: any) => r.billing_type === 'Variable').reduce((s: number, r: any) => s + parseFloat(r.total ?? 0), 0)
    monthlyTrend.push({ label, total: Math.round((fixed + variable)), fixed: Math.round(fixed), variable: Math.round(variable) })
  }

  // ---- Annual YTD ----
  const annualItems = await sql`
    SELECT category, amount, credit_amount, is_paid
    FROM finance_annual_items
    WHERE year = ${year}
  `
  const annualNetAmt = (i: any) => Math.max(0, parseFloat(i.amount ?? 0) - parseFloat(i.credit_amount ?? 0))
  const annualTotal = annualItems.reduce((s: number, i: any) => s + annualNetAmt(i), 0)
  const annualPaid = annualItems.filter((i: any) => i.is_paid).reduce((s: number, i: any) => s + annualNetAmt(i), 0)

  const annualCatMap: Record<string, { total: number; paid: number }> = {}
  for (const i of annualItems) {
    const cat = i.category as string
    if (!annualCatMap[cat]) annualCatMap[cat] = { total: 0, paid: 0 }
    const net = annualNetAmt(i)
    annualCatMap[cat].total += net
    if (i.is_paid) annualCatMap[cat].paid += net
  }
  const annualByCategory = Object.entries(annualCatMap)
    .map(([category, { total, paid }]) => ({
      category,
      total: Math.round(total * 100) / 100,
      paid: Math.round(paid * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)

  // ---- Debts ----
  const debts = await sql`
    SELECT id, name, current_balance, apr, promo_end_date
    FROM finance_debts
    WHERE is_active = true
    ORDER BY sort_order
  `
  const totalDebt = debts.reduce((sum: number, d: any) => sum + parseFloat(d.current_balance), 0)
  const bofaDebt = debts.find((d: any) => d.promo_end_date)
  const bofaDaysLeft = bofaDebt
    ? Math.ceil((new Date(bofaDebt.promo_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  // ---- Recommendations ----
  type Rec = { type: 'info' | 'warning' | 'alert' | 'success'; title: string; message: string }
  const recommendations: Rec[] = []

  if (bofaDaysLeft !== null && bofaDaysLeft <= 90) {
    recommendations.push({
      type: bofaDaysLeft <= 30 ? 'alert' : 'warning',
      title: 'Promo Deadline',
      message: `BofA 0% promo expires in ${bofaDaysLeft} days. Pay off balance before the deadline to avoid interest.`,
    })
  }

  if (monthlyIncome > 0) {
    const leftoverPct = (leftover / monthlyIncome) * 100
    if (leftoverPct < 10) {
      recommendations.push({ type: 'alert', title: 'Tight Cash Flow', message: `Only ${leftoverPct.toFixed(0)}% of income remains after bills. Review variable expenses.` })
    } else if (leftoverPct >= 30) {
      recommendations.push({ type: 'success', title: 'Healthy Surplus', message: `${leftoverPct.toFixed(0)}% of income is left after all bills this month.` })
    } else {
      recommendations.push({ type: 'info', title: 'Cash Flow', message: `${leftoverPct.toFixed(0)}% of income remains after bills this month.` })
    }
  }

  if (unpaidCount > 0) {
    recommendations.push({ type: 'warning', title: 'Unpaid Bills', message: `${unpaidCount} bill${unpaidCount > 1 ? 's' : ''} still pending this month.` })
  } else if (currentBills.length > 0) {
    recommendations.push({ type: 'success', title: 'All Clear!', message: 'Every bill for this month is marked as paid.' })
  }

  if (categoryBreakdown.length > 0) {
    const top = categoryBreakdown[0]
    recommendations.push({ type: 'info', title: 'Top Category', message: `${top.category} is your largest monthly expense at ${top.pct}% of total bills.` })
  }

  if (totalDebt > 0 && leftover > 0) {
    const debtMonths = Math.ceil(totalDebt / leftover)
    if (debtMonths <= 24) {
      recommendations.push({ type: 'success', title: 'Debt Payoff', message: `At current savings rate you could clear all debt in ~${debtMonths} months.` })
    } else {
      recommendations.push({ type: 'warning', title: 'Debt Load', message: `Total debt is ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalDebt)}. Consider accelerating payoff.` })
    }
  }

  if (fixedTotal + variableTotal > 0) {
    const fixedPct = Math.round((fixedTotal / (fixedTotal + variableTotal)) * 100)
    recommendations.push({ type: 'info', title: 'Fixed vs Variable', message: `${fixedPct}% of your bills are fixed costs — the remaining ${100 - fixedPct}% is variable.` })
  }

  const annualRemaining = annualTotal - annualPaid
  if (annualRemaining > 0) {
    recommendations.push({ type: 'info', title: 'Annual Expenses', message: `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(annualRemaining)} in annual expenses still due in ${year}.` })
  }

  // 3-month trend
  const recent = monthlyTrend.slice(-3)
  if (recent.length === 3 && recent[0].total > 0 && recent[2].total > 0) {
    const delta = recent[2].total - recent[0].total
    if (delta > 200) {
      recommendations.push({ type: 'warning', title: 'Rising Costs', message: `Monthly bills up by ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(delta)} over the last 3 months.` })
    } else if (delta < -200) {
      recommendations.push({ type: 'success', title: 'Costs Down', message: `Monthly bills down by ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(delta))} over the last 3 months.` })
    }
  }

  return Response.json({
    data: {
      kpis: {
        monthlyTotal: Math.round(monthlyTotal * 100) / 100,
        monthlyIncome: Math.round(monthlyIncome * 100) / 100,
        paidTotal: Math.round(paidTotal * 100) / 100,
        leftover: Math.round(leftover * 100) / 100,
        fixedTotal: Math.round(fixedTotal * 100) / 100,
        variableTotal: Math.round(variableTotal * 100) / 100,
        unpaidCount,
        totalCount: currentBills.length,
        largestBill,
      },
      categoryBreakdown,
      monthlyTrend,
      annual: {
        total: Math.round(annualTotal * 100) / 100,
        paid: Math.round(annualPaid * 100) / 100,
        remaining: Math.round(annualRemaining * 100) / 100,
        byCategory: annualByCategory,
      },
      debts: {
        total: Math.round(totalDebt * 100) / 100,
        bofaDaysLeft,
      },
      recommendations,
    },
    error: null,
  })
}
