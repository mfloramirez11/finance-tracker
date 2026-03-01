import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

// GET /api/finances/actuals?year=2026&month=2
export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(url.searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const rows = await sql`
    SELECT
      b.id as bill_id, b.name, b.category, b.billing_type, b.default_amount,
      b.account, b.due_day, b.months_active, b.sort_order, b.notes as bill_notes,
      b.frequency, b.is_autopay,
      a.id as actual_id, a.amount as actual_amount, a.is_paid, a.paid_date, a.notes as actual_notes
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${year} AND a.month = ${month}
    WHERE b.is_active = true
      AND (b.months_active IS NULL OR ${month} = ANY(b.months_active))
    ORDER BY b.sort_order, b.name
  `

  return Response.json({ data: rows, error: null })
}

// POST /api/finances/actuals — upsert a monthly actual
export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const { bill_id, year, month, amount, is_paid, paid_date, notes } = body

  if (!bill_id || !year || !month) {
    return Response.json({ data: null, error: 'bill_id, year, month are required' }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO finance_actuals (bill_id, year, month, amount, is_paid, paid_date, notes)
    VALUES (${bill_id}, ${year}, ${month}, ${amount ?? null}, ${is_paid ?? false}, ${paid_date ?? null}, ${notes ?? null})
    ON CONFLICT (bill_id, year, month) DO UPDATE SET
      amount = EXCLUDED.amount,
      is_paid = EXCLUDED.is_paid,
      paid_date = EXCLUDED.paid_date,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
  `
  return Response.json({ data: result[0], error: null })
}
