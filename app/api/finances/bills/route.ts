import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const url = new URL(req.url)
  const active = url.searchParams.get('active')

  let bills
  if (active === 'false') {
    bills = await sql`SELECT * FROM finance_bills ORDER BY sort_order, name`
  } else {
    bills = await sql`SELECT * FROM finance_bills WHERE is_active = true ORDER BY sort_order, name`
  }

  return Response.json({ data: bills, error: null })
}

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true) // admin only
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const { name, category, billing_type, default_amount, account, due_day, months_active, notes, sort_order, frequency, is_autopay } = body

  if (!name || !category || !billing_type) {
    return Response.json({ data: null, error: 'name, category, billing_type are required' }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO finance_bills (name, category, billing_type, default_amount, account, due_day, months_active, notes, sort_order, frequency, is_autopay)
    VALUES (${name}, ${category}, ${billing_type}, ${default_amount ?? null}, ${account ?? null},
            ${due_day ?? null}, ${months_active ?? null}, ${notes ?? null}, ${sort_order ?? 0},
            ${frequency ?? 'Monthly'}, ${is_autopay ?? false})
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
