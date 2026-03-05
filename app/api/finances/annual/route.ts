import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const ANNUAL_CATEGORIES = ['Auto', 'Credit Card', 'Health', 'Housing', 'Insurance', 'Subscriptions', 'Tech', 'Other'] as const

const CreateAnnualSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  category: z.enum(ANNUAL_CATEGORIES),
  amount: z.number().positive('amount must be positive'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be YYYY-MM-DD'),
  year: z.number().int().min(2020).max(2100),
  account: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  is_critical: z.boolean().optional(),
  owner: z.string().max(50).nullable().optional(),
  credit_amount: z.number().nonnegative().nullable().optional(),
})

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

  const netAmt = (i: any) => Math.max(0, parseFloat(i.amount) - parseFloat(i.credit_amount ?? 0))
  const total = items.reduce((s: number, i: any) => s + netAmt(i), 0)
  const paid = items.filter((i: any) => i.is_paid).reduce((s: number, i: any) => s + netAmt(i), 0)

  return Response.json({ data: { items, total, paid, remaining: total - paid }, error: null })
}

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const parse = CreateAnnualSchema.safeParse(body)
  if (!parse.success) {
    const msg = parse.error.issues[0]?.message ?? 'Invalid request body'
    return Response.json({ data: null, error: msg }, { status: 400 })
  }
  const { name, category, amount, due_date, account, year, notes, is_critical, owner, credit_amount } = parse.data

  const result = await sql`
    INSERT INTO finance_annual_items (name, category, amount, due_date, account, year, notes, is_critical, owner, credit_amount)
    VALUES (${name}, ${category}, ${amount}, ${due_date}, ${account ?? null}, ${year}, ${notes ?? null}, ${is_critical ?? false}, ${owner ?? null}, ${credit_amount ?? null})
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
