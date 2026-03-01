import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET() {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const accounts = await sql`
    SELECT * FROM finance_accounts ORDER BY sort_order, name
  `
  return Response.json({ data: accounts, error: null })
}

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { name, type, last_four, paid_by, sort_order } = await req.json()
  if (!name || !type) {
    return Response.json({ data: null, error: 'name and type are required' }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO finance_accounts (name, type, last_four, paid_by, sort_order)
    VALUES (${name}, ${type}, ${last_four ?? null}, ${paid_by ?? null}, ${sort_order ?? 0})
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
