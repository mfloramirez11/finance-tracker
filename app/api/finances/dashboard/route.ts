import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(url.searchParams.get('month') ?? String(new Date().getMonth() + 1))

  // Get settings
  const settings = await sql`SELECT key, value FROM finance_settings`
  const settingsMap: Record<string, string> = {}
  for (const s of settings) settingsMap[s.key as string] = s.value as string

  const biweeklyPay = parseFloat(settingsMap.biweekly_net_pay ?? '0')
  const payPeriods = parseInt(settingsMap.pay_periods_per_year ?? '26')
  const monthlyIncome = (biweeklyPay * payPeriods) / 12

  // Monthly bills with actuals
  const bills = await sql`
    SELECT
      b.id, b.name, b.category, b.billing_type, b.default_amount,
      b.account, b.due_day, b.months_active, b.sort_order,
      a.amount as actual_amount, a.is_paid, a.paid_date, a.id as actual_id
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${year} AND a.month = ${month}
    WHERE b.is_active = true
      AND (b.months_active IS NULL OR ${month} = ANY(b.months_active))
    ORDER BY b.sort_order
  `

  // Calculate monthly totals
  const monthlyTotal = bills.reduce((sum: number, b: any) => {
    const amt = parseFloat(b.actual_amount ?? b.default_amount ?? 0)
    return sum + amt
  }, 0)
  const paidTotal = bills.reduce((sum: number, b: any) => {
    if (!b.is_paid) return sum
    return sum + parseFloat(b.actual_amount ?? b.default_amount ?? 0)
  }, 0)
  const unpaidTotal = monthlyTotal - paidTotal
  const paidCount = bills.filter((b: any) => b.is_paid).length

  // Annual items for this year
  const today = new Date().toISOString().split('T')[0]
  const upcomingAnnual = await sql`
    SELECT * FROM finance_annual_items
    WHERE year = ${year} AND due_date >= ${today}
    ORDER BY due_date ASC
    LIMIT 5
  `
  const annualTotal = await sql`
    SELECT COALESCE(SUM(amount), 0) as total FROM finance_annual_items WHERE year = ${year}
  `
  const annualPaid = await sql`
    SELECT COALESCE(SUM(amount), 0) as total FROM finance_annual_items WHERE year = ${year} AND is_paid = true
  `

  // Debts summary
  const debts = await sql`
    SELECT id, name, current_balance, apr, min_payment, promo_end_date, sort_order
    FROM finance_debts
    WHERE is_active = true
    ORDER BY sort_order
  `
  const totalDebt = debts.reduce((sum: number, d: any) => sum + parseFloat(d.current_balance), 0)

  // BofA promo
  const bofaDebt = debts.find((d: any) => d.promo_end_date)
  const bofaDaysLeft = bofaDebt
    ? Math.ceil((new Date(bofaDebt.promo_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  // Net cash flow
  const leftoverMonthly = monthlyIncome - monthlyTotal

  return Response.json({
    data: {
      income: {
        biweeklyPay,
        monthlyIncome,
        payPeriods,
      },
      monthly: {
        year,
        month,
        total: monthlyTotal,
        paid: paidTotal,
        unpaid: unpaidTotal,
        paidCount,
        totalCount: bills.length,
        leftover: leftoverMonthly,
        bills,
      },
      annual: {
        year,
        total: parseFloat((annualTotal[0] as any)?.total ?? 0),
        paid: parseFloat((annualPaid[0] as any)?.total ?? 0),
        upcoming: upcomingAnnual,
      },
      debts: {
        items: debts,
        total: totalDebt,
        bofaDaysLeft,
      },
      settings: settingsMap,
    },
    error: null,
  })
}
