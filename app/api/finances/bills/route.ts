import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const BILL_CATEGORIES = ['Housing', 'Auto', 'Utilities', 'Wireless', 'Insurance', 'Debt', 'Subscriptions', 'Family'] as const
const BILL_FREQUENCIES = ['Monthly', 'Bi-Monthly', 'Bi-Weekly', 'Quarterly', 'Semi-Annual', 'Annual', 'Varies'] as const

const CreateBillSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  category: z.enum(BILL_CATEGORIES),
  billing_type: z.enum(['Fixed', 'Variable']),
  default_amount: z.number().nonnegative().nullable().optional(),
  account: z.string().max(100).nullable().optional(),
  due_day: z.union([z.string().max(20), z.null()]).optional(),
  months_active: z.array(z.number().int().min(1).max(12)).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().optional(),
  frequency: z.enum(BILL_FREQUENCIES).optional(),
  is_autopay: z.boolean().optional(),
  owner: z.string().max(50).nullable().optional(),
})

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
  const parse = CreateBillSchema.safeParse(body)
  if (!parse.success) {
    const msg = parse.error.issues[0]?.message ?? 'Invalid request body'
    return Response.json({ data: null, error: msg }, { status: 400 })
  }
  const { name, category, billing_type, default_amount, account, due_day, months_active, notes, sort_order, frequency, is_autopay, owner } = parse.data

  const result = await sql`
    INSERT INTO finance_bills (name, category, billing_type, default_amount, account, due_day, months_active, notes, sort_order, frequency, is_autopay, owner)
    VALUES (${name}, ${category}, ${billing_type}, ${default_amount ?? null}, ${account ?? null},
            ${due_day ?? null}, ${months_active ?? null}, ${notes ?? null}, ${sort_order ?? 0},
            ${frequency ?? 'Monthly'}, ${is_autopay ?? false}, ${owner ?? null})
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
