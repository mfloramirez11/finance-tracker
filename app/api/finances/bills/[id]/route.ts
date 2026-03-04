import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql, rawSql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const BILL_CATEGORIES = ['Housing', 'Auto', 'Utilities', 'Wireless', 'Insurance', 'Debt', 'Subscriptions', 'Family'] as const
const BILL_FREQUENCIES = ['Monthly', 'Bi-Monthly', 'Bi-Weekly', 'Quarterly', 'Semi-Annual', 'Annual', 'Varies'] as const

// All fields optional — only keys present in the request body are updated
const PatchBillSchema = z.object({
  name:           z.string().min(1).max(100),
  category:       z.enum(BILL_CATEGORIES),
  billing_type:   z.enum(['Fixed', 'Variable']),
  default_amount: z.number().nonnegative().nullable(),
  account:        z.string().max(100).nullable(),
  due_day:        z.string().max(20).nullable(),
  months_active:  z.array(z.number().int().min(1).max(12)).nullable(),
  is_active:      z.boolean(),
  notes:          z.string().max(500).nullable(),
  sort_order:     z.number().int(),
  frequency:      z.enum(BILL_FREQUENCIES),
  is_autopay:     z.boolean(),
  owner:          z.string().max(50).nullable(),
  debt_id:        z.string().uuid().nullable(),
}).partial()

const UUIDSchema = z.string().uuid()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  if (!UUIDSchema.safeParse(id).success) {
    return Response.json({ data: null, error: 'Invalid bill id' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = PatchBillSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  // Build SET clause from only the fields present in the request body (val !== undefined)
  const updates: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(parsed.data)) {
    if (val !== undefined) {
      updates.push(key)
      values.push(val)
    }
  }

  if (updates.length === 0) {
    return Response.json({ data: null, error: 'No valid fields to update' }, { status: 400 })
  }

  const setClauses = updates.map((key, i) => `${key} = $${i + 2}`).join(', ')
  const queryText = `UPDATE finance_bills SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`
  const result = await rawSql(queryText, [id, ...values])

  if (!result.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: result[0], error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  if (!UUIDSchema.safeParse(id).success) {
    return Response.json({ data: null, error: 'Invalid bill id' }, { status: 400 })
  }

  const result = await sql`DELETE FROM finance_bills WHERE id = ${id} RETURNING id`
  if (!result.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: { id }, error: null })
}
