import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql, rawSql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const ANNUAL_CATEGORIES = ['Auto', 'Housing', 'Insurance', 'Health', 'Tech', 'Subscriptions', 'Family', 'Annual'] as const
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// All fields optional — only keys present in the request body are updated
const PatchAnnualItemSchema = z.object({
  name:        z.string().min(1).max(100),
  category:    z.enum(ANNUAL_CATEGORIES),
  amount:      z.number().positive(),
  due_date:    z.string().regex(DATE_REGEX, 'due_date must be YYYY-MM-DD'),
  account:     z.string().max(100).nullable(),
  is_paid:     z.boolean(),
  paid_date:   z.string().regex(DATE_REGEX, 'paid_date must be YYYY-MM-DD').nullable(),
  notes:       z.string().max(500).nullable(),
  is_critical: z.boolean(),
  owner:        z.string().max(50).nullable(),
  credit_amount: z.number().nonnegative().nullable(),
}).partial()

const UUIDSchema = z.string().uuid()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  if (!UUIDSchema.safeParse(id).success) {
    return Response.json({ data: null, error: 'Invalid item id' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = PatchAnnualItemSchema.safeParse(body)
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
  const queryText = `UPDATE finance_annual_items SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`
  const result = await rawSql(queryText, [id, ...values])

  if (!result.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: result[0], error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  if (!UUIDSchema.safeParse(id).success) {
    return Response.json({ data: null, error: 'Invalid item id' }, { status: 400 })
  }

  const result = await sql`DELETE FROM finance_annual_items WHERE id = ${id} RETURNING id`
  if (!result.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: { id }, error: null })
}
