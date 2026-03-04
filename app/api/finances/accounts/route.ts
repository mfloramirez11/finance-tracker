import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const CreateAccountSchema = z.object({
  name:       z.string().min(1).max(100),
  type:       z.enum(['bank', 'credit_card']),
  last_four:  z.string().length(4).regex(/^\d{4}$/, 'last_four must be 4 digits').nullable().optional(),
  paid_by:    z.string().max(50).nullable().optional(),
  sort_order: z.number().int().optional(),
})

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

  const body = await req.json()
  const parsed = CreateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { name, type, last_four, paid_by, sort_order } = parsed.data

  const result = await sql`
    INSERT INTO finance_accounts (name, type, last_four, paid_by, sort_order)
    VALUES (${name}, ${type}, ${last_four ?? null}, ${paid_by ?? null}, ${sort_order ?? 0})
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
