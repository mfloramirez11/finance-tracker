import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const history = await sql`
    SELECT h.*, b.name as current_bill_name
    FROM finance_bill_history h
    LEFT JOIN finance_bills b ON b.id = h.bill_id
    ORDER BY h.change_date DESC
  `
  return Response.json({ data: history, error: null })
}

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const { bill_id, change_date, category, bill_name, old_provider, old_amount, new_provider, new_amount, reason } = body

  if (!change_date || !bill_name) {
    return Response.json({ data: null, error: 'change_date and bill_name are required' }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO finance_bill_history (bill_id, change_date, category, bill_name, old_provider, old_amount, new_provider, new_amount, reason)
    VALUES (
      ${bill_id ?? null}, ${change_date}, ${category ?? null}, ${bill_name},
      ${old_provider ?? null}, ${old_amount ?? null}, ${new_provider ?? null}, ${new_amount ?? null}, ${reason ?? null}
    )
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
