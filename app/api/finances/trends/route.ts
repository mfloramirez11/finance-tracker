import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))
  const months = 12

  // Monthly spending by category across the year
  const monthly = await sql`
    SELECT
      a.year,
      a.month,
      b.category,
      SUM(COALESCE(a.amount, b.default_amount, 0)) as total
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${year}
    WHERE b.is_active = true
    GROUP BY a.year, a.month, b.category
    ORDER BY a.month, b.category
  `

  // Monthly totals
  const monthlyTotals = await sql`
    SELECT
      a.month,
      SUM(COALESCE(a.amount, b.default_amount, 0)) as total,
      SUM(CASE WHEN a.is_paid = true THEN COALESCE(a.amount, b.default_amount, 0) ELSE 0 END) as paid
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${year}
    WHERE b.is_active = true AND a.month IS NOT NULL
    GROUP BY a.month
    ORDER BY a.month
  `

  // Debt history
  const debtPayments = await sql`
    SELECT
      EXTRACT(MONTH FROM payment_date)::int as month,
      EXTRACT(YEAR FROM payment_date)::int as year,
      SUM(amount) as total_paid
    FROM finance_debt_payments
    WHERE EXTRACT(YEAR FROM payment_date) = ${year}
    GROUP BY month, year
    ORDER BY month
  `

  // Category breakdown for the year
  const categoryTotals = await sql`
    SELECT
      b.category,
      SUM(COALESCE(a.amount, b.default_amount, 0)) as total,
      COUNT(*) as count
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${year}
    WHERE b.is_active = true
    GROUP BY b.category
    ORDER BY total DESC
  `

  // YoY comparison — last year monthly totals
  const lastYear = year - 1
  const lastYearTotals = await sql`
    SELECT
      a.month,
      SUM(COALESCE(a.amount, b.default_amount, 0)) as total
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${lastYear}
    WHERE b.is_active = true AND a.month IS NOT NULL
    GROUP BY a.month
    ORDER BY a.month
  `

  return Response.json({
    data: {
      year,
      monthly,
      monthlyTotals,
      debtPayments,
      categoryTotals,
      lastYearTotals,
    },
    error: null,
  })
}
