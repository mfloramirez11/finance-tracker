import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))

  const items = await sql`
    SELECT * FROM finance_annual_items
    WHERE year = ${year}
    ORDER BY due_date ASC
  `

  const total = items.reduce((s: number, i: any) => s + parseFloat(i.amount), 0)
  const paid = items.filter((i: any) => i.is_paid).reduce((s: number, i: any) => s + parseFloat(i.amount), 0)

  return Response.json({ data: { items, total, paid, remaining: total - paid }, error: null })
}

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const { name, category, amount, due_date, account, year, notes, is_critical } = body

  if (!name || !category || !amount || !due_date || !year) {
    return Response.json({ data: null, error: 'name, category, amount, due_date, year are required' }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO finance_annual_items (name, category, amount, due_date, account, year, notes, is_critical)
    VALUES (${name}, ${category}, ${amount}, ${due_date}, ${account ?? null}, ${year}, ${notes ?? null}, ${is_critical ?? false})
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
